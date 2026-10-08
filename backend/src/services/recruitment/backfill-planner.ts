import type { RawRecruitmentItem } from './types.js';
import { normalizeRecruitmentTitle } from './normalization.service.js';
import { safeNavUrl as safeSscUrl } from './collectors/ssc.collector.js';
import { safeNavUrl as safeRrbUrl } from './collectors/rrb.collector.js';

export interface BackfillRecruitment {
  id: string;
  organization: string;
  title: string;
  notification_number: string | null;
  notification_date: string | null;
  application_start: string | null;
  application_end: string | null;
  exam_date: string | null;
  vacancies: number | null;
  eligibility_rules: unknown;
  created_at: string;
}

export interface BackfillDocument {
  id: string;
  recruitment_id: string;
  official_url: string;
  extraction_status: string | null;
}

export interface PlannedBackfillDocument {
  recruitment: BackfillRecruitment;
  item: RawRecruitmentItem;
  existingDocument: BackfillDocument | null;
}

export interface BackfillPlan {
  documents: PlannedBackfillDocument[];
  unmatchedDiscoveries: number;
  unmatched: Array<{ organization: string; title: string; notification_number: string | null }>;
  missingOfficialUrls: number;
  invalidOfficialUrls: number;
  duplicateDocumentsPrevented: number;
  duplicateRecruitmentsPrevented: number;
}

function normalizedNotificationNumber(value: string | null | undefined): string {
  return (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function completenessScore(recruitment: BackfillRecruitment): number {
  return [
    recruitment.notification_date,
    recruitment.application_start,
    recruitment.application_end,
    recruitment.exam_date,
    recruitment.vacancies,
    recruitment.eligibility_rules,
  ].filter((value) => value !== null && value !== undefined).length;
}

function isOfficialPdf(item: RawRecruitmentItem): boolean {
  if (!item.official_pdf_url) return false;
  const url = item.organization === 'SSC'
    ? safeSscUrl(item.official_pdf_url)
    : item.organization === 'RRB'
      ? safeRrbUrl(item.official_pdf_url, item.official_page_url || 'https://rrb.indianrailways.gov.in/')
      : null;
  return Boolean(url && url === item.official_pdf_url);
}

export function createBackfillPlan(
  recruitments: BackfillRecruitment[],
  existingDocuments: BackfillDocument[],
  discoveries: RawRecruitmentItem[]
): BackfillPlan {
  const plan: BackfillPlan = {
    documents: [],
    unmatchedDiscoveries: 0,
    unmatched: [],
    missingOfficialUrls: 0,
    invalidOfficialUrls: 0,
    duplicateDocumentsPrevented: 0,
    duplicateRecruitmentsPrevented: 0,
  };
  const existingByKey = new Map(existingDocuments.map((document) => [
    `${document.recruitment_id}:${document.official_url}`,
    document,
  ]));
  const plannedKeys = new Set<string>();

  for (const item of discoveries) {
    if (!item.official_pdf_url) {
      plan.missingOfficialUrls++;
      continue;
    }
    if (!isOfficialPdf(item)) {
      plan.invalidOfficialUrls++;
      continue;
    }

    const sameOrganization = recruitments.filter((recruitment) => recruitment.organization === item.organization);
    const matches = item.notification_number
      ? sameOrganization.filter((recruitment) =>
          normalizedNotificationNumber(recruitment.notification_number) === normalizedNotificationNumber(item.notification_number)
        )
      : sameOrganization.filter((recruitment) =>
          normalizeRecruitmentTitle(recruitment.title) === normalizeRecruitmentTitle(item.title)
        );

    if (matches.length === 0) {
      plan.unmatchedDiscoveries++;
      plan.unmatched.push({
        organization: item.organization,
        title: item.title,
        notification_number: item.notification_number,
      });
      continue;
    }
    if (matches.length > 1) plan.duplicateRecruitmentsPrevented += matches.length - 1;

    const recruitment = [...matches].sort((left, right) => completenessScore(right) - completenessScore(left))[0];
    const key = `${recruitment.id}:${item.official_pdf_url}`;
    if (plannedKeys.has(key)) {
      plan.duplicateDocumentsPrevented++;
      continue;
    }
    plannedKeys.add(key);

    const existingDocument = existingByKey.get(key) ?? null;
    if (existingDocument) plan.duplicateDocumentsPrevented++;
    plan.documents.push({ recruitment, item, existingDocument });
  }

  return plan;
}