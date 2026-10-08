import { supabase } from '../../config/supabase.js';
import type { RawRecruitmentItem, CollectionResult } from './types.js';
import { normalizeRecruitmentTitle, sha256 } from './normalization.service.js';
import { deriveRecruitmentStatus, isRecruitmentCurrentOrRelevant } from './recruitmentFreshness.service.js';
import {
  createRecruitmentEvent,
  detectRecruitmentChanges,
  reevaluateAffectedUserMatches,
  RecruitmentState,
} from './events.service.js';

const SSC_SOURCE_URL = 'https://ssc.gov.in/';

interface ExistingRecruitment extends RecruitmentState {
  id: string;
  organization: string;
  notification_number: string | null;
  content_hash: string | null;
  title: string;
  official_pdf_url: string | null;
  notification_date: string | null;
  application_start: string | null;
  application_end: string | null;
  exam_date: string | null;
  vacancies: number | null;
}

/**
 * Persist a batch of raw recruitment items to Supabase.
 */
export async function saveCollectionResults(
  items: RawRecruitmentItem[],
  organization: string
): Promise<CollectionResult> {
  const result: CollectionResult = {
    organization,
    success: true,
    discovered: items.length,
    new: 0,
    updated: 0,
    unchanged: 0,
    documents: 0,
    errors: [],
  };

  // 1. Pre-fetch existing records for this organization
  const { data: existingRecords } = await supabase
    .from('recruitments')
    .select('id, organization, notification_number, content_hash, title, official_pdf_url, notification_date, application_start, application_end, exam_date, vacancies')
    .eq('organization', organization);

  const byNotifNum = new Map<string, ExistingRecruitment>();
  const byHash = new Map<string, ExistingRecruitment>();
  const byTitle = new Map<string, ExistingRecruitment>();
  const recIds = (existingRecords as ExistingRecruitment[] || []).map((r) => r.id);

  (existingRecords as ExistingRecruitment[] || []).forEach((r) => {
    if (r.notification_number) byNotifNum.set(r.notification_number, r);
    if (r.content_hash) byHash.set(r.content_hash, r);
    if (r.title) {
      const titleKey = getTitleKey(organization, r.title);
      const current = byTitle.get(titleKey);
      if (!current || completenessScore(r) > completenessScore(current)) byTitle.set(titleKey, r);
    }
  });

  // 2. Pre-fetch existing documents to avoid N individual database queries
  const existingDocKeys = new Set<string>();
  if (recIds.length > 0) {
    const { data: docs } = await supabase
      .from('recruitment_documents')
      .select('recruitment_id, official_url')
      .in('recruitment_id', recIds);

    (docs || []).forEach((d) => {
      existingDocKeys.add(`${d.recruitment_id}:${d.official_url}`);
    });
  }

  for (const item of items) {
    try {
      await processItem(item, result, byNotifNum, byHash, byTitle, existingDocKeys);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[${organization}] Error processing item "${item.title}": ${msg}`);
      result.errors.push(`"${item.title}": ${msg}`);
    }
  }

  // Update the recruitment_source record's last_checked_at
  await updateSourceTimestamp(organization, SSC_SOURCE_URL);

  return result;
}

async function processItem(
  item: RawRecruitmentItem,
  result: CollectionResult,
  byNotifNum: Map<string, ExistingRecruitment>,
  byHash: Map<string, ExistingRecruitment>,
  byTitle: Map<string, ExistingRecruitment>,
  existingDocKeys: Set<string>
): Promise<void> {
  const now = new Date().toISOString();

  // ── 1. Find existing record ────────────────────────────────────────────────
  let existing: ExistingRecruitment | undefined = item.notification_number
    ? byNotifNum.get(item.notification_number)
    : undefined;

  if (!existing && item.content_hash) {
    existing = byHash.get(item.content_hash);
  }

  if (!existing && item.title) {
    existing = byTitle.get(getTitleKey(item.organization, item.title));
  }

  const existingId: string | null = existing ? existing.id : null;
  const existingHash: string | null = existing ? existing.content_hash : null;

  // ── 2. Determine status with safe date resolution ─────────────────────────
  const safeAppStart = item.application_start ?? existing?.application_start ?? null;
  const safeAppEnd = item.application_end ?? existing?.application_end ?? null;
  const safeVacancies = item.vacancies ?? existing?.vacancies ?? null;
  const safeExamDate = item.exam_date ?? existing?.exam_date ?? null;
  const safeNotifDate = item.notification_date ?? (existing as any)?.notification_date ?? null;

  const status = deriveRecruitmentStatus(
    safeAppStart,
    safeAppEnd,
    safeNotifDate,
    item.notification_number
  );

  // ── 3. Insert or update ────────────────────────────────────────────────────
  let recruitmentId: string;

  if (!existingId) {
    // New record
    const { data, error } = await supabase
      .from('recruitments')
      .insert({
        organization: item.organization,
        title: item.title,
        notification_number: item.notification_number,
        recruitment_type: item.recruitment_type,
        description: item.description,
        vacancies: item.vacancies,
        notification_date: item.notification_date,
        application_start: item.application_start,
        application_end: item.application_end,
        exam_date: item.exam_date,
        official_page_url: item.official_page_url,
        official_pdf_url: item.official_pdf_url,
        status,
        eligibility_rules: null,
        content_hash: item.content_hash,
        last_seen_at: now,
        last_changed_at: now,
        extraction_status: 'pending',
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(`Insert failed: ${error?.message ?? 'no data returned'}`);
    }

    recruitmentId = data.id as string;
    result.new++;

    // Save in in-memory maps to prevent duplicate inserts within the same batch
    const newRecord: ExistingRecruitment = {
      id: recruitmentId,
      organization: item.organization,
      notification_number: item.notification_number,
      content_hash: item.content_hash,
      title: item.title,
      official_pdf_url: item.official_pdf_url,
      notification_date: item.notification_date,
      application_start: item.application_start,
      application_end: item.application_end,
      exam_date: item.exam_date,
      vacancies: item.vacancies,
    };
    if (item.notification_number) byNotifNum.set(item.notification_number, newRecord);
    if (item.content_hash) byHash.set(item.content_hash, newRecord);
    if (item.title) byTitle.set(getTitleKey(item.organization, item.title), newRecord);

    // Create a 'notification' event ONLY for genuinely current/recent recruitments
    if (isRecruitmentCurrentOrRelevant(item)) {
      await createRecruitmentEvent({
        recruitment_id: recruitmentId,
        event_type: 'notification',
        title: `New recruitment: ${item.title}`,
        description: item.description || `New recruitment notification published by ${item.organization}`,
        official_url: item.official_pdf_url || item.official_page_url,
        event_date: item.notification_date || item.application_start || null,
        content_hash: sha256(`notification-${recruitmentId}`),
      });
    }
  } else {
    recruitmentId = existingId;
    const contentChanged = existingHash !== item.content_hash;

    const updatePayload: Record<string, unknown> = {
      last_seen_at: now,
      status,
      recruitment_type: item.recruitment_type,
      official_page_url: item.official_page_url,
    };
    if (item.official_pdf_url && !(existing as any).official_pdf_url) {
      updatePayload.official_pdf_url = item.official_pdf_url;
    }

    if (contentChanged) {
      // Detect meaningful events between old state and new item
      const detectedEvents = detectRecruitmentChanges(recruitmentId, existing!, item);
      for (const eventPayload of detectedEvents) {
        await createRecruitmentEvent(eventPayload);
      }

      // Content has changed — update mutable fields safely (preserve existing non-null fields if item fields are null)
      Object.assign(updatePayload, {
        title: item.title,
        notification_number: item.notification_number,
        description: item.description || (existing as any).description || null,
        vacancies: safeVacancies,
        notification_date: safeNotifDate,
        application_start: safeAppStart,
        application_end: safeAppEnd,
        exam_date: safeExamDate,
        official_pdf_url: (existing as any).official_pdf_url || item.official_pdf_url || null,
        content_hash: item.content_hash,
        last_changed_at: now,
      });
      result.updated++;

      // Re-evaluate ONLY users who already have an existing match for this recruitment
      await reevaluateAffectedUserMatches(recruitmentId);
    } else {
      result.unchanged++;
    }

    const { error } = await supabase
      .from('recruitments')
      .update(updatePayload)
      .eq('id', recruitmentId);

    if (error) {
      throw new Error(`Update failed: ${error.message}`);
    }

    const refreshedRecord: ExistingRecruitment = {
      ...existing!,
      organization: item.organization,
      title: item.title,
      notification_number: item.notification_number || existing!.notification_number,
      official_pdf_url: (updatePayload.official_pdf_url as string | null | undefined) ?? existing!.official_pdf_url,
      notification_date: safeNotifDate,
      application_start: safeAppStart,
      application_end: safeAppEnd,
      exam_date: safeExamDate,
      vacancies: safeVacancies,
      content_hash: item.content_hash || existingHash,
    };
    if (refreshedRecord.notification_number) byNotifNum.set(refreshedRecord.notification_number, refreshedRecord);
    if (refreshedRecord.content_hash) byHash.set(refreshedRecord.content_hash, refreshedRecord);
    if (refreshedRecord.title) byTitle.set(getTitleKey(item.organization, refreshedRecord.title), refreshedRecord);
  }

  // ── 4. Save document record if PDF URL was discovered ─────────────────────
  if (item.official_pdf_url) {
    await upsertDocument(recruitmentId, item, existingDocKeys);
    result.documents++;
  }
}

function getTitleKey(organization: string, title: string): string {
  return organization === 'SSC'
    ? `SSC:${normalizeRecruitmentTitle(title)}`
    : `${organization}:${title}`;
}

function completenessScore(recruitment: ExistingRecruitment): number {
  return [
    recruitment.notification_date,
    recruitment.application_start,
    recruitment.application_end,
    recruitment.exam_date,
    recruitment.vacancies,
  ].filter((value) => value !== null && value !== undefined).length;
}

async function createNotificationEvent(
  recruitmentId: string,
  item: RawRecruitmentItem,
  _now: string
): Promise<void> {
  const eventContentHash = `notification-${recruitmentId}`;

  // Check if this event already exists
  const { data: existing } = await supabase
    .from('recruitment_events')
    .select('id')
    .eq('recruitment_id', recruitmentId)
    .eq('event_type', 'notification')
    .maybeSingle();

  if (existing) return; // Already exists — do not duplicate

  const { error } = await supabase.from('recruitment_events').insert({
    recruitment_id: recruitmentId,
    event_type: 'notification',
    title: `New recruitment discovered: ${item.title}`,
    description: item.description,
    official_url: item.official_page_url,
    event_date: item.notification_date ?? item.application_start ?? null,
    content_hash: eventContentHash,
  });

  if (error) {
    console.warn(`[source.service] Could not create event for ${item.title}: ${error.message}`);
  }
}

async function upsertDocument(
  recruitmentId: string,
  item: RawRecruitmentItem,
  existingDocKeys: Set<string>
): Promise<void> {
  const url = item.official_pdf_url!;
  const key = `${recruitmentId}:${url}`;

  if (existingDocKeys.has(key)) return; // Already recorded in memory

  const { error } = await supabase.from('recruitment_documents').insert({
    recruitment_id: recruitmentId,
    document_type: item.document_type ?? 'notification_pdf',
    title: `${item.title} — Official PDF`,
    official_url: url,
    content_hash: null,
    fetched_at: null,
    published_at: item.document_published_at ?? item.notification_date,
    extraction_status: 'pending',
  });

  if (!error) {
    existingDocKeys.add(key);
  } else {
    console.warn(`[source.service] Could not create document for ${item.title}: ${error.message}`);
  }
}

async function updateSourceTimestamp(
  organization: string,
  _sourceUrl: string
): Promise<void> {
  const { error } = await supabase
    .from('recruitment_sources')
    .update({ last_checked_at: new Date().toISOString() })
    .eq('organization', organization);

  if (error) {
    console.warn(`[source.service] Could not update last_checked_at for ${organization}: ${error.message}`);
  }
}
