import axios from 'axios';
import https from 'https';
import * as cheerio from 'cheerio';
import type { RecruitmentCollector } from '../collector.interface.js';
import type { RawRecruitmentItem } from '../types.js';
import { sha256, normalizeDate, buildContentString } from '../normalization.service.js';

const ORGANIZATION = 'APPSC';
const APPSC_BASE_URL = 'https://portal-psc.ap.gov.in';
const APPSC_PDF_BASE_URL = 'https://psc.ap.gov.in';
const APPSC_SOURCE_URL = 'https://portal-psc.ap.gov.in/';

const APPSC_TARGET_URLS = [
  'https://portal-psc.ap.gov.in/HomePages/RecruitmentNotifications.aspx',
  'https://portal-psc.ap.gov.in/HomePages/RecruitmentNotifications',
];

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const httpClient = axios.create({
  timeout: 45_000,
  httpsAgent,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
});

/**
 * Safely build a full URL from a relative or absolute path.
 * Guards against literal "NULL"/"null", empty strings, or invalid paths.
 */
function safeNavUrl(path: string | null | undefined, baseUrl: string = APPSC_BASE_URL): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  if (trimmed.toLowerCase() === 'null') return null;
  if (trimmed === '') return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('/')) return `${baseUrl}${trimmed}`;
  return `${baseUrl}/${trimmed}`;
}

/**
 * Classify recruitment type based on APPSC title content.
 */
function classifyRecruitmentType(title: string): string {
  const lower = title.toLowerCase();

  if (
    lower.includes('corrigendum') ||
    lower.includes('errata') ||
    lower.includes('web note') ||
    lower.includes('press note')
  ) {
    return 'announcement';
  }

  if (lower.includes('supplemental') || lower.includes('supplementary')) {
    return 'recruitment_notification'; // Supplemental notifications are recruitment updates
  }

  if (
    lower.includes('result') ||
    lower.includes('marks') ||
    lower.includes('answer key') ||
    lower.includes('rejected list')
  ) {
    return 'other';
  }

  return 'recruitment_notification';
}

export class APPSCCollector implements RecruitmentCollector {
  readonly organization = ORGANIZATION;

  async collect(): Promise<RawRecruitmentItem[]> {
    console.log(`[APPSC] Starting complete collection`);
    const discoveredAt = new Date().toISOString();
    const items: RawRecruitmentItem[] = [];
    const seenKeys = new Set<string>();

    for (const pageUrl of APPSC_TARGET_URLS) {
      try {
        console.log(`[APPSC] Fetching official recruitment page: ${pageUrl}`);
        const response = await httpClient.get(pageUrl);
        console.log(`[APPSC] Source ${pageUrl} fetched successfully (${response.data.length} bytes)`);

        const $ = cheerio.load(response.data);

        // Broad link selector matching all PDF, document, and notification links
        $('a').each((_, el) => {
          const href = $(el).attr('href');
          const rawTitle = $(el).text().trim().replace(/\s+/g, ' ');

          if (!href || !rawTitle) return;

          const lowerTitle = rawTitle.toLowerCase();
          const lowerHref = href.toLowerCase();

          // Ignore generic website links, user manuals, FAQs, meetings, official lists
          const isNonRecruitment =
            lowerTitle.includes('user manual') ||
            lowerTitle.includes('faq') ||
            lowerTitle.includes('commission meeting') ||
            lowerTitle.includes('higher official') ||
            lowerTitle.includes('fee payment') ||
            lowerTitle.includes('otpr') ||
            lowerTitle.includes('help desk') ||
            lowerTitle.includes('instructions to candidate') ||
            lowerHref.includes('usermanual') ||
            lowerHref.includes('otpr') ||
            lowerHref.includes('faq');

          if (isNonRecruitment) return;

          // Check if link is a genuine notification link
          const isDocLink =
            href.includes('NotificationDocuments') ||
            href.includes('Notification_Documents') ||
            /Notification\s*No/i.test(rawTitle) ||
            /Notifn\.?\s*No/i.test(rawTitle) ||
            /Notification\s*to\s*the\s*post/i.test(rawTitle) ||
            /Direct\s*Recruitment/i.test(rawTitle) ||
            /No\.?\s*[0-9]{1,2}\s*[\/\_]\s*[0-9]{4}/i.test(rawTitle);

          if (!isDocLink) return;

          // Extract Notification Number (e.g. "07/2026", "26/2026", "16/2026", "05/2024", "14/2023")
          const notifNumMatch =
            rawTitle.match(/Notification\s*No\.?\s*([0-9]{1,2}\s*[\/\_]\s*[0-9]{4})/i) ||
            rawTitle.match(/Notifn\.?\s*No\.?\s*([0-9]{1,2}\s*[\/\_]\s*[0-9]{4})/i) ||
            rawTitle.match(/No\.?\s*([0-9]{1,2}\s*[\/\_]\s*[0-9]{4})/i);

          let notifNum: string | null = null;
          if (notifNumMatch) {
            const rawNum = notifNumMatch[1].replace(/\s+/g, '').replace('_', '/');
            // Normalize leading zero for number part if single digit (e.g. "7/2026" -> "07/2026")
            const parts = rawNum.split('/');
            if (parts.length === 2) {
              const numPart = parts[0].padStart(2, '0');
              notifNum = `${numPart}/${parts[1]}`;
            } else {
              notifNum = rawNum;
            }
          }

          // Extract Notification Date (e.g. "15/09/2026", "09.02.2024", "22/12/2023")
          const notifDateMatch =
            rawTitle.match(/Dat(?:ed|e)?\.?\s*:?\s*([0-9]{2}[\.\/\-][0-9]{2}[\.\/\-][0-9]{4})/i) ||
            rawTitle.match(/Dt\.?\s*:?\s*([0-9]{2}[\.\/\-][0-9]{2}[\.\/\-][0-9]{4})/i);

          const rawNotifDate = notifDateMatch ? notifDateMatch[1] : null;
          const normalizedNotifDate = rawNotifDate ? normalizeDate(rawNotifDate) : null;

          // Resolve safe PDF URL
          const pdfUrl = href.endsWith('.pdf') || href.includes('/Documents/')
            ? safeNavUrl(href, APPSC_PDF_BASE_URL)
            : safeNavUrl(href, APPSC_BASE_URL);

          // Standard official page URL
          const officialPageUrl = safeNavUrl(pageUrl, APPSC_BASE_URL);

          const recruitmentType = classifyRecruitmentType(rawTitle);

          const contentFields = {
            organization: ORGANIZATION,
            notification_number: notifNum || null,
            title: rawTitle,
            notification_date: normalizedNotifDate || null,
          };

          const contentHash = sha256(buildContentString(contentFields));

          // Deduplicate by notification_number or content_hash or pdfUrl
          const dedupKey = notifNum ? `notif:${notifNum}` : (pdfUrl ? `pdf:${pdfUrl}` : `hash:${contentHash}`);
          if (seenKeys.has(dedupKey)) return;
          seenKeys.add(dedupKey);

          items.push({
            organization: ORGANIZATION,
            title: rawTitle,
            notification_number: notifNum,
            recruitment_type: recruitmentType,
            description: null,
            vacancies: null,
            notification_date: normalizedNotifDate,
            application_start: null,
            application_end: null,
            exam_date: null,
            official_page_url: officialPageUrl,
            official_pdf_url: pdfUrl,
            source_url: APPSC_SOURCE_URL,
            source_document_url: pageUrl,
            discovered_at: discoveredAt,
            raw_text: JSON.stringify({ href, title: rawTitle, notifNum, rawNotifDate }),
            content_hash: contentHash,
            min_age: null,
            max_age: null,
            fee: null,
          });
        });
      } catch (err: any) {
        console.warn(`[APPSC] Warning fetching ${pageUrl}: ${err.message}`);
      }
    }

    console.log(`[APPSC] Discovered ${items.length} unique recruitment notifications`);
    return items;
  }
}

export const appscCollector = new APPSCCollector();
