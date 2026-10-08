import axios from 'axios';
import https from 'https';
import * as cheerio from 'cheerio';
import type { RecruitmentCollector } from '../collector.interface.js';
import type { RawRecruitmentItem } from '../types.js';
import { sha256, normalizeDate, buildContentString } from '../normalization.service.js';

const ORGANIZATION = 'RRB';
const RRB_SOURCE_URL = 'https://www.rrb.gov.in/';

// Verified official RRB regional portals (21 regional boards + 1 central portal)
const RRB_OFFICIAL_PORTALS = [
  { name: 'RRB Central', url: 'https://www.rrb.gov.in/' },
  { name: 'RRB Ahmedabad', url: 'https://www.rrbahmedabad.gov.in/' },
  { name: 'RRB Ajmer', url: 'https://www.rrbajmer.gov.in/' },
  { name: 'RRB Bengaluru', url: 'https://www.rrbbnc.gov.in/' },
  { name: 'RRB Bhopal', url: 'https://www.rrbhopal.gov.in/' },
  { name: 'RRB Bhubaneswar', url: 'https://www.rrbbbs.gov.in/' },
  { name: 'RRB Bilaspur', url: 'https://rrbbilaspur.gov.in/' },
  { name: 'RRB Chandigarh', url: 'https://www.rrbcdg.gov.in/' },
  { name: 'RRB Chennai', url: 'https://www.rrbchennai.gov.in/' },
  { name: 'RRB Gorakhpur', url: 'https://www.rrbgkp.gov.in/' },
  { name: 'RRB Guwahati', url: 'https://www.rrbguwahati.gov.in/' },
  { name: 'RRB Jammu-Srinagar', url: 'https://www.rrbjammu.nic.in/' },
  { name: 'RRB Kolkata', url: 'https://www.rrbkolkata.gov.in/' },
  { name: 'RRB Malda', url: 'https://www.rrbmalda.gov.in/' },
  { name: 'RRB Mumbai', url: 'https://rrbmumbai.gov.in/' },
  { name: 'RRB Muzaffarpur', url: 'https://www.rrbmuzaffarpur.gov.in/' },
  { name: 'RRB Patna', url: 'https://www.rrbpatna.gov.in/' },
  { name: 'RRB Prayagraj', url: 'https://rrbald.gov.in/' },
  { name: 'RRB Ranchi', url: 'https://www.rrbranchi.gov.in/' },
  { name: 'RRB Secunderabad', url: 'https://www.rrbsecunderabad.gov.in/' },
  { name: 'RRB Siliguri', url: 'https://www.rrbsiliguri.gov.in/' },
  { name: 'RRB Thiruvananthapuram', url: 'https://www.rrbthiruvananthapuram.gov.in/' },
];

const OFFICIAL_RRB_HOSTS = new Set([
  'rrb.indianrailways.gov.in',
  ...RRB_OFFICIAL_PORTALS.map((portal) => new URL(portal.url).hostname.replace(/^www\./, '')),
]);

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const httpClient = axios.create({
  timeout: 12_000,
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
export function safeNavUrl(path: string | null | undefined, baseUrl: string): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  if (trimmed.toLowerCase() === 'null') return null;
  if (trimmed === '') return null;
  try {
    const url = new URL(trimmed, baseUrl);
    if (url.protocol !== 'https:' || !OFFICIAL_RRB_HOSTS.has(url.hostname.replace(/^www\./, ''))) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeCenNumber(rawValue: string | null | undefined): string | null {
  if (!rawValue) return null;
  let decoded = rawValue;
  try {
    decoded = decodeURIComponent(rawValue);
  } catch {
    return null;
  }
  const normalized = decoded.trim().toUpperCase().replace(/\s+/g, ' ');
  const match = normalized.match(/^(?:CEN\s+)?(RPF\s+)?([A-Z0-9]+)\s*\/\s*(20\d{2})$/);
  if (!match) return null;
  const prefix = match[1] ? 'RPF ' : '';
  const number = /^\d+$/.test(match[2]) ? match[2].padStart(2, '0') : match[2];
  return `CEN ${prefix}${number}/${match[3]}`;
}

function normalizeRrbDate(value: string | null | undefined): string | null {
  const match = value?.match(/\b(\d{2})[./-](\d{2})[./-](\d{4})\b/);
  if (!match) return null;
  const [, day, month, year] = match;
  const parsed = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== `${year}-${month}-${day}`) return null;
  return `${year}-${month}-${day}`;
}

export interface RrbNotificationDocument {
  notification_number: string;
  description: string;
  notification_date: string | null;
  official_pdf_url: string;
}

export function parseRrbNotificationDocuments(html: string, pageUrl: string): RrbNotificationDocument[] {
  const $ = cheerio.load(html);
  const documents: RrbNotificationDocument[] = [];

  $('tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 6) return;

    const notificationNumber = normalizeCenNumber($(cells[1]).text());
    const description = $(cells[3]).text().trim().replace(/\s+/g, ' ');
    if (!notificationNumber || !/detailed\s+centralised\s+employment\s+notification|विस्तृत केंद्रीकृत रोजगार अधिसूचना/i.test(description)) {
      return;
    }

    const pdfOptions = $(cells[5]).find('option').filter((__, option) => {
      const optionUrl = safeNavUrl($(option).attr('value'), pageUrl);
      return Boolean(optionUrl && /\.pdf(?:\/|$|\?)/i.test(new URL(optionUrl).pathname + new URL(optionUrl).search));
    });
    const englishOption = pdfOptions.filter((__, option) =>
      /^english$/i.test($(option).text().trim())
    ).first();
    const selectedOption = englishOption.length > 0 ? englishOption : pdfOptions.first();
    const pdfUrl = safeNavUrl(selectedOption.attr('value'), pageUrl);
    if (!pdfUrl || !/\.pdf(?:\/|$|\?)/i.test(new URL(pdfUrl).pathname + new URL(pdfUrl).search)) return;

    documents.push({
      notification_number: notificationNumber,
      description,
      notification_date: normalizeRrbDate($(cells[4]).text()),
      official_pdf_url: pdfUrl,
    });
  });

  return documents;
}

export class RRBCollector implements RecruitmentCollector {
  readonly organization = ORGANIZATION;

  async collect(): Promise<RawRecruitmentItem[]> {
    console.log(`[RRB] Starting collection`);
    console.log(`[RRB] Fetching official RRB regional portals`);

    const discoveredAt = new Date().toISOString();
    const itemsMap = new Map<string, RawRecruitmentItem>();
    const notificationPages = new Map<string, Map<string, { url: string; referer: string }>>();

    for (const portal of RRB_OFFICIAL_PORTALS) {
      try {
        console.log(`[RRB] Fetching ${portal.name} (${portal.url})...`);
        const response = await httpClient.get(portal.url);
        const $ = cheerio.load(response.data);
        const responseUrl = response.request?.res?.responseUrl || portal.url;

        // Target links containing cennum, cenum, or CEN in href or text
        $('a[href*="cennum"], a[href*="cenum"], a[href*="CEN"], a[href*="cen"]').each((_, el) => {
          const href = $(el).attr('href') || '';
          const rawText = $(el).text().trim().replace(/\s+/g, ' ');

          // Extract CEN Number (e.g. "CEN 01/2026", "CEN 05/2024", "CEN RPF 01/2024")
          let rawCenCode: string | null = null;
          try {
            const linkUrl = new URL(href, responseUrl);
            rawCenCode = linkUrl.searchParams.get('cennum') || linkUrl.searchParams.get('cenum');
          } catch {
            rawCenCode = null;
          }
          const textMatch = rawText.match(/CEN\s*(?:NO\.?|NUMBER)?\s*([A-Z0-9/\s-]+)/i);
          const notificationNumber = normalizeCenNumber(rawCenCode || textMatch?.[1]);
          if (!notificationNumber) return;

          let category = '';
          let pageUrl: string | null = null;
          try {
            const linkUrl = new URL(href, responseUrl);
            category = linkUrl.searchParams.get('category')?.trim().toLowerCase() || '';
            pageUrl = safeNavUrl(linkUrl.toString(), responseUrl);
          } catch {
            return;
          }

          if (category === 'notification' && pageUrl) {
            const cenPages = notificationPages.get(notificationNumber) ?? new Map<string, { url: string; referer: string }>();
            cenPages.set(pageUrl, { url: pageUrl, referer: responseUrl });
            notificationPages.set(notificationNumber, cenPages);
          }

          // Extract Notification Date if present in text (e.g. "14-09-2026" or "14/09/2026")
          const dateMatch = rawText.match(/([0-9]{2}[\.\/\-][0-9]{2}[\.\/\-][0-9]{4})/);
          const rawNotifDate = dateMatch ? dateMatch[1] : null;
          const normalizedNotifDate = rawNotifDate ? normalizeDate(rawNotifDate) : null;

          // Build clean title
          const title = `RRB ${notificationNumber} - Centralised Employment Notice`;

          // Safe URLs
          const pdfUrl = /\.pdf(?:$|\?)/i.test(href) ? safeNavUrl(href, responseUrl) : null;

          const contentFields = {
            organization: ORGANIZATION,
            notification_number: notificationNumber,
            title,
            notification_date: normalizedNotifDate || null,
          };

          // If this CEN has already been discovered from another regional site, retain item
          // but update official_pdf_url if a PDF URL is found
          if (itemsMap.has(notificationNumber)) {
            const existing = itemsMap.get(notificationNumber)!;
            if (category === 'notification' && pageUrl) {
              existing.official_page_url = pageUrl;
            }
            if (!existing.official_pdf_url && pdfUrl) {
              existing.official_pdf_url = pdfUrl;
            }
            return;
          }

          itemsMap.set(notificationNumber, {
            organization: ORGANIZATION,
            title,
            notification_number: notificationNumber,
            recruitment_type: 'recruitment_notification',
            description: `Centralised Employment Notice (${notificationNumber}) published on official RRB portals.`,
            vacancies: null,
            notification_date: normalizedNotifDate,
            application_start: null,
            application_end: null,
            exam_date: null,
            official_page_url: pageUrl,
            official_pdf_url: pdfUrl,
            source_url: RRB_SOURCE_URL,
            source_document_url: portal.url,
            discovered_at: discoveredAt,
            raw_text: JSON.stringify({ href, text: rawText, portal: portal.name }),
            content_hash: sha256(buildContentString(contentFields)),
            min_age: null,
            max_age: null,
            fee: null,
          });
        });
      } catch (err: any) {
        console.warn(`[RRB] Could not fetch ${portal.name}: ${err.message}`);
      }
    }

    const pages = [...notificationPages.values()].flatMap((cenPages) => [...cenPages.values()]);
    const pageDocuments = await fetchNotificationPages(pages);
    for (const document of pageDocuments) {
      const item = itemsMap.get(document.notification_number);
      if (!item) continue;
      if (!item.official_pdf_url) item.official_pdf_url = document.official_pdf_url;
      if (!item.notification_date) item.notification_date = document.notification_date;
      if (!item.official_page_url) item.official_page_url = pages[0]?.url ?? null;
    }

    const items = Array.from(itemsMap.values());
    console.log(`[RRB] Source fetched successfully — Discovered ${items.length} unique CEN recruitment notifications`);
    return items;
  }
}

async function fetchNotificationPages(pages: Array<{ url: string; referer: string }>): Promise<RrbNotificationDocument[]> {
  const documents: RrbNotificationDocument[] = [];
  let nextIndex = 0;
  const workerCount = Math.min(4, pages.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < pages.length) {
      const page = pages[nextIndex++];
      try {
        const response = await httpClient.get(page.url, {
          headers: { Referer: page.referer },
        });
        documents.push(...parseRrbNotificationDocuments(
          String(response.data),
          response.request?.res?.responseUrl || page.url
        ));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[RRB] Could not inspect official notification page ${page.url}: ${message}`);
      }
    }
  }));

  return [...new Map(documents.map((document) => [document.notification_number, document])).values()];
}

export const rrbCollector = new RRBCollector();
