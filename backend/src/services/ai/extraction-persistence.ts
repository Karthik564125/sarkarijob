import type { RecruitmentExtraction } from './extraction.schema.js';
import { deriveRecruitmentStatus } from '../recruitment/recruitmentFreshness.service.js';
import { normalizeDate, toPositiveInt } from '../recruitment/normalization.service.js';

export interface ExistingRecruitmentData {
  title: string;
  description?: string | null;
  notification_number: string | null;
  notification_date: string | null;
  application_start: string | null;
  application_end: string | null;
  exam_date: string | null;
  vacancies: number | null;
  status: string;
  eligibility_rules: unknown;
}

export function mergeNonEmptyExtraction(existing: unknown, incoming: unknown): unknown {
  if (incoming === undefined) return existing;
  if (incoming === null) return hasKnownValue(existing) ? existing : null;
  if (typeof incoming === 'string') return incoming.trim() || (hasKnownValue(existing) ? existing : null);
  if (Array.isArray(incoming)) return incoming.length > 0 || hasKnownValue(existing) ? incoming.length > 0 ? incoming : existing : incoming;

  if (typeof incoming === 'object') {
    const incomingObject = incoming as Record<string, unknown>;
    const existingObject = typeof existing === 'object' && existing !== null && !Array.isArray(existing)
      ? existing as Record<string, unknown>
      : {};
    const keys = Object.keys(incomingObject);
    if (keys.length === 0) return hasKnownValue(existing) ? existing : incoming;
    if (!hasKnownValue(existing)) return incoming;

    const merged = { ...existingObject };
    for (const key of keys) {
      if (incomingObject[key] === undefined) continue;
      merged[key] = Object.prototype.hasOwnProperty.call(existingObject, key)
        ? mergeNonEmptyExtraction(existingObject[key], incomingObject[key])
        : mergeNonEmptyExtraction(undefined, incomingObject[key]);
    }
    return merged;
  }

  return incoming;
}

function hasKnownValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

export function buildExtractionRecruitmentUpdate(
  existing: ExistingRecruitmentData,
  extraction: RecruitmentExtraction,
  publishedAt: string | null | undefined,
  now = new Date()
): Pick<ExistingRecruitmentData, 'title' | 'description' | 'notification_number' | 'notification_date' | 'application_start' | 'application_end' | 'exam_date' | 'vacancies' | 'status' | 'eligibility_rules'> {
  const notificationDate = normalizeDate(extraction.notification_date)
    ?? normalizeDate(publishedAt)
    ?? existing.notification_date;
  const applicationStart = normalizeDate(extraction.application_start) ?? existing.application_start;
  const applicationEnd = normalizeDate(extraction.application_end) ?? existing.application_end;
  const examDate = normalizeDate(extraction.exam_date) ?? existing.exam_date;
  const vacancies = toPositiveInt(extraction.vacancies) ?? existing.vacancies;

  return {
    title: extraction.recruitment_title?.trim() || existing.title,
    description: extraction.description?.trim() || existing.description || null,
    notification_number: existing.notification_number || extraction.notification_number?.trim() || null,
    notification_date: notificationDate,
    application_start: applicationStart,
    application_end: applicationEnd,
    exam_date: examDate,
    vacancies,
    status: existing.status === 'cancelled'
      ? 'cancelled'
      : deriveRecruitmentStatus(applicationStart, applicationEnd, notificationDate, existing.notification_number, now),
    eligibility_rules: mergeNonEmptyExtraction(existing.eligibility_rules, extraction),
  };
}