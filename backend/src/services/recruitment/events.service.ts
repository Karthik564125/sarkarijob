import { supabase } from '../../config/supabase.js';
import { sha256 } from './normalization.service.js';
import { evaluateUserRecruitment } from './matching.service.js';
import type { RawRecruitmentItem } from './types.js';

export type EventType =
  | 'notification'
  | 'application_opened'
  | 'corrigendum'
  | 'application_extended'
  | 'application_deadline_changed'
  | 'exam_date_changed'
  | 'vacancy_changed'
  | 'admit_card'
  | 'answer_key'
  | 'result'
  | 'cancelled';

export interface CreateEventPayload {
  recruitment_id: string;
  event_type: EventType;
  title: string;
  description?: string | null;
  official_url?: string | null;
  event_date?: string | null;
  content_hash: string;
}

export interface RecruitmentState {
  id: string;
  title: string;
  notification_number: string | null;
  application_start: string | null;
  application_end: string | null;
  exam_date: string | null;
  vacancies: number | null;
  content_hash: string | null;
}

/**
 * Classify a document or notice title into standard event types.
 * Returns null if the title does not explicitly contain classification keywords.
 */
export function classifyDocumentTitle(title: string): EventType | null {
  const lower = title.toLowerCase();

  if (
    lower.includes('admit card') ||
    lower.includes('hall ticket') ||
    lower.includes('e-admit') ||
    lower.includes('admission certificate')
  ) {
    return 'admit_card';
  }

  if (
    lower.includes('answer key') ||
    lower.includes('response sheet') ||
    lower.includes('objection tracker')
  ) {
    return 'answer_key';
  }

  if (
    lower.includes('final result') ||
    lower.includes('selection list') ||
    lower.includes('merit list') ||
    lower.includes('shortlisted candidates') ||
    lower.includes('cutoff') ||
    lower.includes('marks') ||
    lower.includes('result')
  ) {
    return 'result';
  }

  if (
    lower.includes('cancelled') ||
    lower.includes('cancellation') ||
    lower.includes('withdrawn') ||
    lower.includes('postponed indefinitely')
  ) {
    return 'cancelled';
  }

  if (
    lower.includes('corrigendum') ||
    lower.includes('errata') ||
    lower.includes('amendment') ||
    lower.includes('addendum') ||
    lower.includes('revised notice')
  ) {
    return 'corrigendum';
  }

  return null;
}

/**
 * Persist a recruitment event to Supabase.
 * Idempotent: Uses UNIQUE constraint (recruitment_id, event_type, content_hash) to avoid duplicates.
 */
export async function createRecruitmentEvent(payload: CreateEventPayload): Promise<boolean> {
  const { data: existing } = await supabase
    .from('recruitment_events')
    .select('id')
    .eq('recruitment_id', payload.recruitment_id)
    .eq('event_type', payload.event_type)
    .eq('content_hash', payload.content_hash)
    .maybeSingle();

  if (existing) {
    return false; // Already exists — idempotent skip
  }

  const { error } = await supabase.from('recruitment_events').insert({
    recruitment_id: payload.recruitment_id,
    event_type: payload.event_type,
    title: payload.title,
    description: payload.description || null,
    official_url: payload.official_url || null,
    event_date: payload.event_date || null,
    content_hash: payload.content_hash,
  });

  if (error) {
    // Catch unique constraint violation gracefully
    if (error.code === '23505') return false;
    console.warn(`[EventService] Could not insert event (${payload.event_type}): ${error.message}`);
    return false;
  }

  return true;
}

/**
 * Detect meaningful changes between old stored recruitment state and freshly scraped item.
 * Returns array of generated events.
 */
export function detectRecruitmentChanges(
  recruitmentId: string,
  oldState: RecruitmentState,
  newItem: RawRecruitmentItem
): CreateEventPayload[] {
  const events: CreateEventPayload[] = [];

  // 0. Application Start / Opening Event
  const oldStart = oldState.application_start;
  const newStart = newItem.application_start;
  if (newStart && (!oldStart || oldStart !== newStart)) {
    events.push({
      recruitment_id: recruitmentId,
      event_type: 'application_opened',
      title: 'Applications Open',
      description: `Application portal opened on ${newStart}`,
      official_url: newItem.official_pdf_url || newItem.official_page_url,
      event_date: newStart,
      content_hash: sha256(`application-opened-${recruitmentId}-${newStart}`),
    });
  }

  // 1. Application Deadline Change / Extension
  const oldEnd = oldState.application_end;
  const newEnd = newItem.application_end;

  if (oldEnd !== newEnd) {
    if (oldEnd && newEnd) {
      if (newEnd > oldEnd) {
        // Extended later -> application_extended
        events.push({
          recruitment_id: recruitmentId,
          event_type: 'application_extended',
          title: 'Application deadline extended',
          description: `Application deadline extended from ${oldEnd} to ${newEnd}`,
          official_url: newItem.official_pdf_url || newItem.official_page_url,
          event_date: newEnd,
          content_hash: sha256(`app-extended-${oldEnd}-${newEnd}`),
        });
      } else {
        // Changed earlier -> application_deadline_changed
        events.push({
          recruitment_id: recruitmentId,
          event_type: 'application_deadline_changed',
          title: 'Application deadline changed',
          description: `Application deadline changed from ${oldEnd} to ${newEnd}`,
          official_url: newItem.official_pdf_url || newItem.official_page_url,
          event_date: newEnd,
          content_hash: sha256(`app-deadline-changed-${oldEnd}-${newEnd}`),
        });
      }
    } else if (!oldEnd && newEnd) {
      events.push({
        recruitment_id: recruitmentId,
        event_type: 'application_deadline_changed',
        title: 'Application deadline announced',
        description: `Application closing date set to ${newEnd}`,
        official_url: newItem.official_pdf_url || newItem.official_page_url,
        event_date: newEnd,
        content_hash: sha256(`app-deadline-announced-${newEnd}`),
      });
    }
  }

  // 2. Exam Date Change
  const oldExam = oldState.exam_date;
  const newExam = newItem.exam_date;

  if (oldExam !== newExam) {
    if (!oldExam && newExam) {
      events.push({
        recruitment_id: recruitmentId,
        event_type: 'exam_date_changed',
        title: 'Exam date announced',
        description: `Scheduled examination date announced as ${newExam}`,
        official_url: newItem.official_pdf_url || newItem.official_page_url,
        event_date: newExam,
        content_hash: sha256(`exam-date-announced-${newExam}`),
      });
    } else if (oldExam && newExam) {
      events.push({
        recruitment_id: recruitmentId,
        event_type: 'exam_date_changed',
        title: 'Exam date updated',
        description: `Scheduled examination date changed from ${oldExam} to ${newExam}`,
        official_url: newItem.official_pdf_url || newItem.official_page_url,
        event_date: newExam,
        content_hash: sha256(`exam-date-changed-${oldExam}-${newExam}`),
      });
    }
  }

  // 3. Vacancies Change
  const oldVac = oldState.vacancies;
  const newVac = newItem.vacancies;

  if (oldVac !== newVac && newVac !== null) {
    if (oldVac !== null) {
      events.push({
        recruitment_id: recruitmentId,
        event_type: 'vacancy_changed',
        title: 'Vacancy count updated',
        description: `Vacancy count updated from ${oldVac} to ${newVac}`,
        official_url: newItem.official_pdf_url || newItem.official_page_url,
        content_hash: sha256(`vacancies-changed-${oldVac}-${newVac}`),
      });
    }
  }

  // 4. Classified Document Event (Corrigendum, Admit Card, Answer Key, Result, Cancelled)
  const docType = classifyDocumentTitle(newItem.title);
  if (docType) {
    events.push({
      recruitment_id: recruitmentId,
      event_type: docType,
      title: `${newItem.title}`,
      description: newItem.description || `New ${docType.replace('_', ' ')} published`,
      official_url: newItem.official_pdf_url || newItem.official_page_url,
      event_date: newItem.notification_date || null,
      content_hash: sha256(`doc-event-${docType}-${newItem.official_pdf_url || newItem.title}`),
    });
  }

  return events;
}

/**
 * Re-evaluate user matches ONLY for users who already have an existing match for this recruitment.
 */
export async function reevaluateAffectedUserMatches(recruitmentId: string): Promise<number> {
  const { data: existingMatches, error } = await supabase
    .from('user_recruitment_matches')
    .select('user_id')
    .eq('recruitment_id', recruitmentId);

  if (error || !existingMatches || existingMatches.length === 0) {
    return 0;
  }

  let count = 0;
  for (const match of existingMatches) {
    try {
      await evaluateUserRecruitment(match.user_id, recruitmentId);
      count++;
    } catch (err: any) {
      console.warn(`[EventService] Could not re-evaluate match for user ${match.user_id}: ${err.message}`);
    }
  }

  return count;
}
