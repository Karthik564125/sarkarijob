import { supabase } from '../../config/supabase.js';
import { SSCCollector } from './collectors/ssc.collector.js';
import { APPSCCollector } from './collectors/appsc.collector.js';
import { RRBCollector } from './collectors/rrb.collector.js';
import { saveCollectionResults } from './source.service.js';
import type { CollectionResult } from './types.js';
import { processRecruitmentDocument } from '../ai/document-processing.service.js';
import { evaluateUserRecruitment } from './matching.service.js';
import { isRecruitmentCurrentOrRelevant } from './recruitmentFreshness.service.js';

export interface MonitoringRunOptions {
  skipCollection?: boolean;           // For dev/testing: skip crawling official portals
  limitDocuments?: number;            // Limit max documents sent to Gemini in one run
  limitUsers?: number;                // Limit user matching evaluation batch size
  forceRetryDocuments?: boolean;      // Re-run extraction even for completed docs
}

export interface MonitoringRunSummary {
  status: 'completed' | 'already_running' | 'failed';
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  sources: {
    ssc: CollectionResult | null;
    appsc: CollectionResult | null;
    rrb: CollectionResult | null;
  };
  documents_processed: number;
  documents_failed: number;
  documents_skipped: number;
  matches_evaluated: number;
  errors: string[];
}

// Global in-memory concurrency lock
let isMonitoringRunning = false;

/**
 * Returns whether a monitoring run is currently active.
 */
export function isMonitoringActive(): boolean {
  return isMonitoringRunning;
}

/**
 * Main orchestration entry point for recruitment monitoring.
 * Crawls sources -> Persists records -> Processes pending PDFs with Gemini -> Evaluates user matches.
 */
export async function runRecruitmentMonitoring(
  options: MonitoringRunOptions = {}
): Promise<MonitoringRunSummary> {
  const startedAt = new Date().toISOString();
  const startTimeMs = Date.now();

  // 1. Concurrency Safety Lock
  if (isMonitoringRunning) {
    console.warn('[MonitoringService] Concurrent monitoring run requested but already running. Skipping.');
    return {
      status: 'already_running',
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startTimeMs,
      sources: { ssc: null, appsc: null, rrb: null },
      documents_processed: 0,
      documents_failed: 0,
      documents_skipped: 0,
      matches_evaluated: 0,
      errors: ['A recruitment monitoring cycle is already in progress.'],
    };
  }

  isMonitoringRunning = true;
  console.log('[MonitoringService] Starting automated recruitment monitoring run...');

  const summary: MonitoringRunSummary = {
    status: 'completed',
    started_at: startedAt,
    sources: { ssc: null, appsc: null, rrb: null },
    documents_processed: 0,
    documents_failed: 0,
    documents_skipped: 0,
    matches_evaluated: 0,
    errors: [],
  };

  const affectedRecruitmentIds = new Set<string>();

  try {
    // 2. STEP A: Run Collectors (Sequential & Fault-Tolerant)
    if (!options.skipCollection) {
      // 2a. SSC Collector
      try {
        console.log('[MonitoringService] Invoking SSC Collector...');
        const sscCollector = new SSCCollector();
        const sscItems = await sscCollector.collect();
        const sscRes = await saveCollectionResults(sscItems, sscCollector.organization);
        summary.sources.ssc = sscRes;
        console.log(`[MonitoringService] SSC finished: ${sscRes.new} new, ${sscRes.updated} updated, ${sscRes.documents} docs.`);
      } catch (err: any) {
        const msg = `SSC Collector failed: ${err.message}`;
        console.error(`[MonitoringService] ${msg}`);
        summary.errors.push(msg);
      }

      // 2b. APPSC Collector
      try {
        console.log('[MonitoringService] Invoking APPSC Collector...');
        const appscCollector = new APPSCCollector();
        const appscItems = await appscCollector.collect();
        const appscRes = await saveCollectionResults(appscItems, appscCollector.organization);
        summary.sources.appsc = appscRes;
        console.log(`[MonitoringService] APPSC finished: ${appscRes.new} new, ${appscRes.updated} updated, ${appscRes.documents} docs.`);
      } catch (err: any) {
        const msg = `APPSC Collector failed: ${err.message}`;
        console.error(`[MonitoringService] ${msg}`);
        summary.errors.push(msg);
      }

      // 2c. RRB Collector
      try {
        console.log('[MonitoringService] Invoking RRB Collector...');
        const rrbCollector = new RRBCollector();
        const rrbItems = await rrbCollector.collect();
        const rrbRes = await saveCollectionResults(rrbItems, rrbCollector.organization);
        summary.sources.rrb = rrbRes;
        console.log(`[MonitoringService] RRB finished: ${rrbRes.new} new, ${rrbRes.updated} updated, ${rrbRes.documents} docs.`);
      } catch (err: any) {
        const msg = `RRB Collector failed: ${err.message}`;
        console.error(`[MonitoringService] ${msg}`);
        summary.errors.push(msg);
      }
    } else {
      console.log('[MonitoringService] skipCollection flag is set. Skipping live crawler execution.');
    }

    // 3. STEP B: Downstream Processing of Pending/Changed Documents
    const defaultBatch = process.env.DOCUMENT_PROCESS_BATCH_SIZE
      ? parseInt(process.env.DOCUMENT_PROCESS_BATCH_SIZE, 10)
      : 10;
    const docLimit = options.limitDocuments ?? defaultBatch;
    console.log(`[MonitoringService] Querying pending recruitment documents (limit=${docLimit})...`);

    // limitDocuments === 0 means "skip document processing in this run"
    if (docLimit === 0) {
      console.log('[MonitoringService] limitDocuments=0: skipping document processing step.');
    } else {
      let docQuery = supabase
        .from('recruitment_documents')
        .select(`
          id,
          recruitment_id,
          extraction_status,
          created_at,
          recruitments!inner (
            id,
            status,
            notification_date,
            application_start,
            application_end,
            notification_number
          )
        `)
        .eq('extraction_status', 'pending')
        .order('created_at', { ascending: false })
        .limit(docLimit);

      const { data: pendingDocs, error: docErr } = await docQuery;

      if (docErr) {
        const msg = `Failed to query pending documents: ${docErr.message}`;
        console.error(`[MonitoringService] ${msg}`);
        summary.errors.push(msg);
      } else {
        const docList = pendingDocs || [];
        console.log(`[MonitoringService] Found ${docList.length} pending document(s) for Gemini extraction.`);

        for (const docItem of docList) {
          const rec = (docItem as any).recruitments;
          if (rec && !isRecruitmentCurrentOrRelevant(rec)) {
            console.log(`[MonitoringService] Skipping Gemini processing for historical recruitment doc ${docItem.id} (rec: ${rec.notification_number || rec.id}).`);
            summary.documents_skipped++;
            continue;
          }

          try {
            const docRes = await processRecruitmentDocument(docItem.id, {
              forceRetry: options.forceRetryDocuments,
            });

            if (docRes.status === 'completed') {
              summary.documents_processed++;
              if (docRes.recruitmentId) {
                affectedRecruitmentIds.add(docRes.recruitmentId);
              }
            } else if (docRes.status === 'already_processed') {
              summary.documents_skipped++;
            } else {
              summary.documents_failed++;
              if (docRes.error) summary.errors.push(`Doc ${docItem.id}: ${docRes.error}`);
            }
          } catch (err: any) {
            summary.documents_failed++;
            const msg = `Document processing error (${docItem.id}): ${err.message}`;
            console.error(`[MonitoringService] ${msg}`);
            summary.errors.push(msg);
          }
        }
      }
    }
    // 4. STEP C: Evaluate User Matches for Active/Upcoming & Affected Recruitments
    // Always include current active/upcoming recruitments to ensure no discovered recruitment is left unmatched
    const { data: activeRecs } = await supabase
      .from('recruitments')
      .select('id, status, notification_date, application_start, application_end, notification_number')
      .in('status', ['open', 'closing_soon', 'upcoming']);

    if (activeRecs && activeRecs.length > 0) {
      for (const r of activeRecs) {
        if (isRecruitmentCurrentOrRelevant(r)) {
          affectedRecruitmentIds.add(r.id);
        }
      }
    }

    if (affectedRecruitmentIds.size > 0) {
      console.log(`[MonitoringService] Evaluating user matches for ${affectedRecruitmentIds.size} recruitment(s)...`);

      // Load active users
      const userLimit = options.limitUsers ?? 50;
      const { data: users } = await supabase
        .from('users')
        .select('id')
        .limit(userLimit);

      if (users && users.length > 0) {
        for (const recId of affectedRecruitmentIds) {
          for (const u of users) {
            try {
              await evaluateUserRecruitment(u.id, recId);
              summary.matches_evaluated++;
            } catch (err: any) {
              console.warn(`[MonitoringService] Could not evaluate match for user ${u.id} + rec ${recId}: ${err.message}`);
            }
          }
        }
      }
    } else {
      console.log('[MonitoringService] No active recruitments found for user matching.');
    }

  } catch (globalErr: any) {
    summary.status = 'failed';
    const msg = `Global monitoring pipeline failure: ${globalErr.message}`;
    console.error(`[MonitoringService] ${msg}`);
    summary.errors.push(msg);
  } finally {
    isMonitoringRunning = false;
    summary.completed_at = new Date().toISOString();
    summary.duration_ms = Date.now() - startTimeMs;
    console.log(`[MonitoringService] Monitoring run completed in ${summary.duration_ms}ms (status=${summary.status}).`);
  }

  return summary;
}
