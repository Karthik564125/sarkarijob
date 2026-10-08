import axios from 'axios';
import type { RecruitmentCollector } from '../collector.interface.js';
import type { RawRecruitmentItem } from '../types.js';
import { sha256, normalizeDate, toPositiveInt, buildContentString } from '../normalization.service.js';

const SSC_API_BASE = 'https://ssc.gov.in/api';
const SSC_BASE_URL = 'https://ssc.gov.in';
const SSC_SOURCE_URL = 'https://ssc.gov.in/';
const SSC_NOTICE_BOARD_URL = `${SSC_API_BASE}/general-website/portal/notice-boards`;
const ORGANIZATION = 'SSC';

/**
 * Safely build a full URL from a relative path returned by the SSC API.
 * The SSC API returns literal strings "NULL", "null", "", or undefined
 * for entries that have no real navigation URL.
 * Returns null whenever the path is falsy, literally "NULL"/"null",
 * or does not start with a forward slash.
 */
export function safeNavUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  // Reject literal null strings returned by the SSC API
  if (trimmed.toLowerCase() === 'null') return null;
  if (trimmed === '') return null;
  try {
    const url = new URL(trimmed, SSC_BASE_URL);
    if (url.protocol !== 'https:' || (url.hostname !== 'ssc.gov.in' && !url.hostname.endsWith('.ssc.gov.in'))) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function getSscAttachmentUrl(path: string | null | undefined): string | null {
  if (!path || path.trim().toLowerCase() === 'null') return null;
  const normalizedPath = path.trim().replace(/\\/g, '/');
  const attachmentPath = normalizedPath.startsWith('http')
    ? normalizedPath
    : normalizedPath.startsWith('/api/attachment/')
      ? normalizedPath
      : `/api/attachment/${normalizedPath.replace(/^\/+/, '')}`;
  const url = safeNavUrl(attachmentPath);
  return url && /\.pdf(?:$|\?)/i.test(url) ? url : null;
}

export function normalizeSscRecruitmentTitle(headline: string): string | null {
  const title = headline.trim()
    .replace(/^Notice\s+of\s+/i, '')
    .replace(/^Tentative\s+Vacancy\s+of\s+/i, '')
    .replace(/\s+/g, ' ');
  const year = title.match(/\b(20\d{2})\b/)?.[1];
  if (!year) return null;

  if (/combined\s+higher\s+secondary/i.test(title)) {
    return `Combined Higher Secondary Level (10+2) Examination, ${year}`;
  }
  if (/combined\s+graduate\s+level/i.test(title)) {
    return `Combined Graduate Level Examination, ${year}`;
  }

  return title;
}

interface SscNoticeAttachment {
  fileName?: string | null;
  type?: string | null;
  path?: string | null;
}

interface SscNoticeBoardRecord {
  id: string;
  headline: string;
  createdAt?: string | null;
  attachments?: SscNoticeAttachment[] | null;
}

export function mapSscRecruitmentNotice(
  notice: SscNoticeBoardRecord,
  discoveredAt = new Date().toISOString()
): RawRecruitmentItem | null {
  const isRecruitmentNotice = /^Notice\s+of\s+.+\bExamination\b/i.test(notice.headline);
  const isCglVacancyNotice = /^Tentative\s+Vacancy\s+of\s+Combined\s+Graduate\s+Level\s+Examination,?\s*2026\b/i.test(notice.headline);
  if (!isRecruitmentNotice && !isCglVacancyNotice) return null;
  const title = normalizeSscRecruitmentTitle(notice.headline);
  const attachment = notice.attachments?.find((item) =>
    item.type?.toLowerCase() === 'application/pdf' || /\.pdf$/i.test(item.fileName ?? '')
  );
  const pdfUrl = getSscAttachmentUrl(attachment?.path);
  if (!title || !pdfUrl) return null;

  const notificationDate = isRecruitmentNotice ? normalizeDate(notice.createdAt) : null;
  const contentFields = {
    organization: ORGANIZATION,
    title,
    notification_date: notificationDate,
  };

  return {
    organization: ORGANIZATION,
    title,
    notification_number: null,
    recruitment_type: 'recruitment_notification',
    description: notice.headline,
    vacancies: null,
    notification_date: notificationDate,
    application_start: null,
    application_end: null,
    exam_date: null,
    official_page_url: SSC_SOURCE_URL,
    official_pdf_url: pdfUrl,
    ...(isCglVacancyNotice ? { document_type: 'vacancy_notice_pdf' } : {}),
    source_url: SSC_SOURCE_URL,
    source_document_url: SSC_NOTICE_BOARD_URL,
    document_published_at: normalizeDate(notice.createdAt),
    discovered_at: discoveredAt,
    raw_text: JSON.stringify(notice),
    content_hash: sha256(buildContentString(contentFields)),
    min_age: null,
    max_age: null,
    fee: null,
  };
}

const USER_AGENT =
  'Mozilla/5.0 (compatible; SarkariJobBot/1.0; +https://github.com/bhavana050604/sarkarijob)';

import https from 'https';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const httpClient = axios.create({
  timeout: 15_000,
  httpsAgent,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json, text/plain, */*',
  },
});

// ─── Types matching SSC API response shapes ───────────────────────────────────

interface SscExamType {
  id: string;
  examCode: string;
  examName: string;
  navigationUrl: string;
  description: string;
}

interface SscLiveExam {
  id: string;
  examId: string;
  examYear: string;
  examCode: string;
  displayExamCode: string;
  examDate: string | null;
  applicationStartDate: string | null;
  applicationEndDate: string | null;
  lastDateForFee: string | null;
  correctionStartDate: string | null;
  correctionEndDate: string | null;
  examDescription: string;
  isActive: boolean;
  admitCardStartDate: string | null;
  admitCardEndDate: string | null;
  answerKeyStartDate: string | null;
  answerKeyEndDate: string | null;
  fee: string | null;
  cwfee1: string | null;
  cwfee2: string | null;
  minAge: number | null;
  maxAge: number | null;
  examName: string;
  createdAt: string | null;
  updatedAt: string | null;
  attachments: Array<{ url?: string; type?: string; name?: string }>;
  examNames?: {
    id: string;
    examName: string;
    examCode: string;
    description: string;
    navigationUrl?: string;
  };
}

interface SscAllExam {
  id: string;
  examCode: string;
  examName: string;
  navigationUrl: string;
  description: string;
}

interface SscApiResponse<T> {
  statusCode: string;
  statusMessage: string;
  data: T[];
  isCache?: boolean;
}

export function shouldKeepSscAllExam(exam: SscAllExam, liveExamNames: Set<string>): boolean {
  const trimmedName = exam.examName?.trim() ?? '';
  if (!trimmedName) {
    return false;
  }

  if (liveExamNames.has(trimmedName.toLowerCase())) {
    return false;
  }

  // /allExams is a catalogue endpoint: it does not include application start/end
  // dates, so those rows are not valid recruitment notifications for active tracking.
  return false;
}

// ─── SSCCollector ─────────────────────────────────────────────────────────────

export class SSCCollector implements RecruitmentCollector {
  readonly organization = ORGANIZATION;

  async collect(options: { noticePages?: number } = {}): Promise<RawRecruitmentItem[]> {
    console.log(`[SSC] Starting collection`);

    const items: RawRecruitmentItem[] = [];
    const discoveredAt = new Date().toISOString();

    try {
      // 1. Fetch live (currently open) exams — richest data source
      const liveItems = await this.collectLiveExams(discoveredAt);
      items.push(...liveItems);
      console.log(`[SSC] liveExams: ${liveItems.length} item(s) discovered`);

      // 2. Fetch all exams catalogue for additional recruitment entries
      const allExamsItems = await this.collectAllExams(discoveredAt, liveItems);
      items.push(...allExamsItems);
      console.log(`[SSC] allExams supplement: ${allExamsItems.length} additional item(s)`);

      const noticeItems = await this.collectRecruitmentNotices(discoveredAt, options.noticePages ?? 20);
      items.push(...noticeItems);
      console.log(`[SSC] Official recruitment notifications: ${noticeItems.length} item(s) discovered`);

      console.log(`[SSC] Source fetched — Total discovered: ${items.length}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[SSC] Collection error: ${msg}`);
      // Re-throw so the caller can record the error
      throw err;
    }

    return items;
  }

  private async collectRecruitmentNotices(discoveredAt: string, maxPages: number): Promise<RawRecruitmentItem[]> {
    const items = new Map<string, RawRecruitmentItem>();
    const pages = Math.min(100, Math.max(1, Math.floor(maxPages)));

    for (let page = 1; page <= pages; page++) {
      try {
        const response = await httpClient.get<SscApiResponse<SscNoticeBoardRecord>>(SSC_NOTICE_BOARD_URL, {
          params: {
            page,
            limit: 10,
            contentType: 'notice-boards',
            key: 'createdAt',
            order: 'DESC',
            isAttachment: true,
            language: 'english',
            attributes: 'id,headline,examId,contentType,redirectUrl,startDate,endDate,language,createdAt',
          },
        });

        if (response.data.statusCode !== '200' || !Array.isArray(response.data.data)) {
          console.warn(`[SSC] notice-boards returned non-200 status on page ${page}: ${response.data.statusCode}`);
          break;
        }
        if (response.data.data.length === 0) break;

        for (const notice of response.data.data) {
          const item = mapSscRecruitmentNotice(notice, discoveredAt);
          if (item?.official_pdf_url) items.set(item.official_pdf_url, item);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[SSC] Could not fetch official notice board page ${page}: ${msg}`);
        break;
      }
    }

    return [...items.values()].sort((left, right) => {
      const leftIsPrimaryNotice = /^Notice\s+of\s+/i.test(left.description ?? '');
      const rightIsPrimaryNotice = /^Notice\s+of\s+/i.test(right.description ?? '');
      return Number(rightIsPrimaryNotice) - Number(leftIsPrimaryNotice);
    });
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async collectLiveExams(discoveredAt: string): Promise<RawRecruitmentItem[]> {
    const url = `${SSC_API_BASE}/admin/5.1/liveExams`;
    const res = await httpClient.get<SscApiResponse<SscLiveExam>>(url);

    if (res.data.statusCode !== '200' || !Array.isArray(res.data.data)) {
      console.warn(`[SSC] liveExams returned non-200 status: ${res.data.statusCode}`);
      return [];
    }

    return res.data.data
      .filter((exam) => exam.isActive)
      .map((exam) => this.normalizeLiveExam(exam, discoveredAt));
  }

  private async collectAllExams(
    discoveredAt: string,
    alreadyCollected: RawRecruitmentItem[]
  ): Promise<RawRecruitmentItem[]> {
    const url = `${SSC_API_BASE}/admin/5.1/allExams`;
    const res = await httpClient.get<SscApiResponse<SscAllExam>>(url);

    if (res.data.statusCode !== '200' || !Array.isArray(res.data.data)) {
      console.warn(`[SSC] allExams returned non-200 status: ${res.data.statusCode}`);
      return [];
    }

    // Deduplicate: skip entries whose examName already appeared in live exams.
    // IMPORTANT: the /allExams endpoint is a catalogue-only source and does not
    // include application_start/application_end fields. Those rows are not valid
    // recruitment notifications for active tracking, so they must not be promoted
    // into the current pipeline. This avoids fabricated date values and keeps the
    // source-selection logic consistent for every exam, not just CGL.
    const liveExamNames = new Set(alreadyCollected.map((i) => i.title.toLowerCase().trim()));

    const validCatalogEntries = res.data.data.filter((exam) =>
      shouldKeepSscAllExam(exam, liveExamNames)
    );

    return validCatalogEntries.map((exam) => this.normalizeAllExam(exam, discoveredAt));
  }

  private normalizeLiveExam(exam: SscLiveExam, discoveredAt: string): RawRecruitmentItem {
    const title = exam.examName || exam.examDescription || `SSC ${exam.examCode} ${exam.examYear}`;
    const applicationStart = normalizeDate(exam.applicationStartDate);
    const applicationEnd = normalizeDate(exam.applicationEndDate);
    const examDate = normalizeDate(exam.examDate);

    // Derive status hint from dates
    const now = new Date();
    const endDate = exam.applicationEndDate ? new Date(exam.applicationEndDate) : null;

    // Pick the best PDF URL from attachments if any
    const pdfAttachment = exam.attachments?.find(
      (a) => a.url?.toLowerCase().endsWith('.pdf')
    );
    const pdfUrl = pdfAttachment?.url
      ? `${SSC_API_BASE}/attachment/uploads/${pdfAttachment.url}`
      : null;

    const contentFields = {
      organization: ORGANIZATION,
      examCode: exam.examCode,
      examYear: exam.examYear,
      examName: title,
      applicationStartDate: exam.applicationStartDate ?? null,
      applicationEndDate: exam.applicationEndDate ?? null,
      examDate: exam.examDate ?? null,
      minAge: exam.minAge ?? null,
      maxAge: exam.maxAge ?? null,
      fee: exam.fee ?? null,
    };

    // liveExams entries have real application dates and are actively open
    const recruitmentType = applicationStart || applicationEnd
      ? 'recruitment_notification'
      : 'exam_catalogue';

    return {
      organization: ORGANIZATION,
      title,
      notification_number: null,            // SSC does not expose a notification_number in this API
      recruitment_type: recruitmentType,
      description: exam.examDescription || exam.examNames?.description || null,
      vacancies: null,                       // Not provided in this API endpoint
      notification_date: normalizeDate(exam.createdAt),
      application_start: applicationStart,
      application_end: applicationEnd,
      exam_date: examDate,
      // safeNavUrl guards against literal "NULL"/"null" strings from the SSC API
      official_page_url: safeNavUrl(exam.examNames?.navigationUrl),
      official_pdf_url: pdfUrl,
      source_url: SSC_SOURCE_URL,
      source_document_url: `${SSC_API_BASE}/admin/5.1/liveExams`,
      discovered_at: discoveredAt,
      raw_text: JSON.stringify(exam),
      content_hash: sha256(buildContentString(contentFields)),
      min_age: toPositiveInt(exam.minAge),
      max_age: toPositiveInt(exam.maxAge),
      fee: exam.fee ?? null,
    };
  }

  private normalizeAllExam(exam: SscAllExam, discoveredAt: string): RawRecruitmentItem {
    const title = exam.examName;

    const contentFields = {
      organization: ORGANIZATION,
      examCode: exam.examCode,
      examName: exam.examName,
      description: exam.description ?? null,
    };

    return {
      organization: ORGANIZATION,
      title,
      notification_number: null,
      // allExams catalogue entries — no application date data, classify as exam_catalogue
      recruitment_type: 'exam_catalogue',
      description: exam.description || null,
      vacancies: null,
      notification_date: null,
      application_start: null,
      application_end: null,
      exam_date: null,
      // safeNavUrl guards against literal "NULL"/"null" strings from the SSC API
      official_page_url: safeNavUrl(exam.navigationUrl),
      official_pdf_url: null,
      source_url: SSC_SOURCE_URL,
      source_document_url: `${SSC_API_BASE}/admin/5.1/allExams`,
      discovered_at: discoveredAt,
      raw_text: JSON.stringify(exam),
      content_hash: sha256(buildContentString(contentFields)),
      min_age: null,
      max_age: null,
      fee: null,
    };
  }
}
