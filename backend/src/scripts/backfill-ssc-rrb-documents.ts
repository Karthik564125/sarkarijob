import 'dotenv/config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { supabase } from '../config/supabase.js';
import { SSCCollector } from '../services/recruitment/collectors/ssc.collector.js';
import { RRBCollector } from '../services/recruitment/collectors/rrb.collector.js';
import { createBackfillPlan, type BackfillDocument, type BackfillRecruitment } from '../services/recruitment/backfill-planner.js';
import { processRecruitmentDocument } from '../services/ai/document-processing.service.js';

export async function runSscRrbDocumentBackfill(apply = false): Promise<Record<string, unknown>> {
  const { data: recruitments, error: recruitmentError } = await supabase
    .from('recruitments')
    .select('id, organization, title, notification_number, notification_date, application_start, application_end, exam_date, vacancies, eligibility_rules, created_at')
    .in('organization', ['SSC', 'RRB'])
    .limit(1000);

  if (recruitmentError) throw new Error(`Could not load existing SSC/RRB recruitments: ${recruitmentError.message}`);
  const rows = (recruitments ?? []) as BackfillRecruitment[];
  const recruitmentIds = rows.map((row) => row.id);
  const { data: existingDocuments, error: documentsError } = recruitmentIds.length > 0
    ? await supabase
        .from('recruitment_documents')
        .select('id, recruitment_id, official_url, extraction_status')
        .in('recruitment_id', recruitmentIds)
        .limit(5000)
    : { data: [], error: null };

  if (documentsError) throw new Error(`Could not load existing documents: ${documentsError.message}`);

  const [sscResult, rrbResult] = await Promise.allSettled([
    new SSCCollector().collect({ noticePages: 100 }),
    new RRBCollector().collect(),
  ]);
  const sscItems = sscResult.status === 'fulfilled' ? sscResult.value : [];
  const rrbItems = rrbResult.status === 'fulfilled' ? rrbResult.value : [];
  const sourceErrors = {
    SSC: sscResult.status === 'rejected'
      ? (sscResult.reason instanceof Error ? sscResult.reason.message : String(sscResult.reason))
      : null,
    RRB: rrbResult.status === 'rejected'
      ? (rrbResult.reason instanceof Error ? rrbResult.reason.message : String(rrbResult.reason))
      : null,
  };
  const plan = createBackfillPlan(
    rows,
    (existingDocuments ?? []) as BackfillDocument[],
    [...sscItems, ...rrbItems]
  );

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    existingRecruitments: {
      SSC: rows.filter((row) => row.organization === 'SSC').length,
      RRB: rows.filter((row) => row.organization === 'RRB').length,
    },
    discoveredDocuments: {
      SSC: sscItems.filter((item) => item.official_pdf_url).length,
      RRB: rrbItems.filter((item) => item.official_pdf_url).length,
    },
    matchedDocuments: {
      SSC: plan.documents.filter((candidate) => candidate.item.organization === 'SSC').length,
      RRB: plan.documents.filter((candidate) => candidate.item.organization === 'RRB').length,
    },
    matchedRecruitments: {
      SSC: new Set(plan.documents.filter((candidate) => candidate.item.organization === 'SSC').map((candidate) => candidate.recruitment.id)).size,
      RRB: new Set(plan.documents.filter((candidate) => candidate.item.organization === 'RRB').map((candidate) => candidate.recruitment.id)).size,
    },
    sourceErrors,
    unmatchedDiscoveries: plan.unmatchedDiscoveries,
    unmatched: plan.unmatched,
    missingOfficialUrls: plan.missingOfficialUrls,
    invalidOfficialUrls: plan.invalidOfficialUrls,
    duplicateDocumentsPrevented: plan.duplicateDocumentsPrevented,
    duplicateRecruitmentsPrevented: plan.duplicateRecruitmentsPrevented,
    createdDocuments: 0,
    completed: 0,
    skippedCompleted: 0,
    failed: 0,
    planned: plan.documents.map((candidate) => ({
      organization: candidate.item.organization,
      recruitmentId: candidate.recruitment.id,
      title: candidate.recruitment.title,
      notification_number: candidate.recruitment.notification_number,
      officialUrl: candidate.item.official_pdf_url,
      existingStatus: candidate.existingDocument?.extraction_status ?? null,
    })),
    results: [] as Array<{ organization: string; title: string; officialUrl: string; status: string; error?: string }>,
  };

  if (!apply) return summary;

  const processingCandidates = [...plan.documents].sort((left, right) => {
    const dateLeft = left.item.document_published_at ?? left.item.notification_date ?? '1900-01-01';
    const dateRight = right.item.document_published_at ?? right.item.notification_date ?? '1900-01-01';
    return dateLeft.localeCompare(dateRight);
  });

  for (const candidate of processingCandidates) {
    let document = candidate.existingDocument;
    if (!document) {
      const { data, error } = await supabase
        .from('recruitment_documents')
        .upsert({
          recruitment_id: candidate.recruitment.id,
          document_type: candidate.item.document_type ?? 'notification_pdf',
          title: `${candidate.item.title} — Official notification`,
          official_url: candidate.item.official_pdf_url,
          content_hash: candidate.item.content_hash,
          published_at: candidate.item.notification_date,
          extraction_status: 'pending',
        }, { onConflict: 'recruitment_id,official_url', ignoreDuplicates: true })
        .select('id, recruitment_id, official_url, extraction_status')
        .maybeSingle();

      if (error) {
        summary.failed++;
        summary.results.push({
          organization: candidate.item.organization,
          title: candidate.item.title,
          officialUrl: candidate.item.official_pdf_url!,
          status: 'failed',
          error: error.message,
        });
        continue;
      }
      if (data) {
        document = data as BackfillDocument;
        summary.createdDocuments++;
      } else {
        const { data: racedDocument, error: lookupError } = await supabase
          .from('recruitment_documents')
          .select('id, recruitment_id, official_url, extraction_status')
          .eq('recruitment_id', candidate.recruitment.id)
          .eq('official_url', candidate.item.official_pdf_url)
          .maybeSingle();
        if (lookupError || !racedDocument) {
          summary.failed++;
          summary.results.push({
            organization: candidate.item.organization,
            title: candidate.item.title,
            officialUrl: candidate.item.official_pdf_url!,
            status: 'failed',
            error: lookupError?.message ?? 'Document row missing after idempotent upsert.',
          });
          continue;
        }
        document = racedDocument as BackfillDocument;
      }
    }

    const { error: recruitmentUrlError } = await supabase
      .from('recruitments')
      .update({ official_pdf_url: candidate.item.official_pdf_url })
      .eq('id', candidate.recruitment.id)
      .is('official_pdf_url', null);
    if (recruitmentUrlError) {
      console.warn(`[Backfill] Could not set missing official PDF URL for ${candidate.recruitment.id}: ${recruitmentUrlError.message}`);
    }

    if (document.extraction_status === 'completed' || document.extraction_status === 'processing') {
      summary.skippedCompleted++;
      summary.results.push({
        organization: candidate.item.organization,
        title: candidate.item.title,
        officialUrl: candidate.item.official_pdf_url!,
        status: document.extraction_status === 'completed' ? 'already_processed' : 'already_processing',
      });
      continue;
    }

    const result = await processRecruitmentDocument(document.id, {
      forceRetry: false,
      emitEvents: false,
      reevaluateMatches: true,
    });
    if (result.status === 'completed') summary.completed++;
    else if (result.status === 'already_processed' || result.status === 'skipped') summary.skippedCompleted++;
    else summary.failed++;
    summary.results.push({
      organization: candidate.item.organization,
      title: candidate.item.title,
      officialUrl: candidate.item.official_pdf_url!,
      status: result.status,
      ...(result.error ? { error: result.error } : {}),
    });
  }

  return summary;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  const apply = process.argv.includes('--apply');
  runSscRrbDocumentBackfill(apply)
    .then((summary) => console.log(JSON.stringify(summary, null, 2)))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}