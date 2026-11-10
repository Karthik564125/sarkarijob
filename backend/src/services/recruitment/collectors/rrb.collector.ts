import axios from 'axios';
import https from 'https';
import * as cheerio from 'cheerio';
import type { RecruitmentCollector } from '../collector.interface.js';
import type { RawRecruitmentItem } from '../types.js';
import { sha256, normalizeDate, buildContentString } from '../normalization.service.js';

const ORGANIZATION = 'RRB';
export const RRB_APPLY_PORTAL_URL = 'https://www.rrbapply.gov.in/';
export const RRB_APPLY_API_URL = 'https://api.recruitmentrrb.in/api/Advertisement/WhatsNew';
const RRB_CENTRAL_URL = 'https://www.rrb.gov.in/';

// Verified official RRB regional portals (21 regional boards + 1 central portal)
export const RRB_OFFICIAL_PORTALS = [
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

export const OFFICIAL_RRB_HOSTS = new Set([
  'rrb.indianrailways.gov.in',
  'rrbapply.gov.in',
  'www.rrbapply.gov.in',
  'recruitmentrrb.in',
  'api.recruitmentrrb.in',
  ...RRB_OFFICIAL_PORTALS.map((portal) => new URL(portal.url).hostname.replace(/^www\./, '')),
]);

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const httpClient = axios.create({
  timeout: 8_000,
  httpsAgent,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
});

export interface SourceDiagnostic {
  name: string;
  url: string;
  status: 'success' | 'failed';
  httpStatus?: number;
  error?: string;
  timestamp: string;
}

export interface CollectorDiagnostics {
  sourcesAttempted: number;
  sourcesAccessed: number;
  sourcesFailed: number;
  censDiscovered: number;
  sourceDiagnostics: SourceDiagnostic[];
}

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
    const host = url.hostname.replace(/^www\./, '');
    if (url.protocol !== 'https:' || !OFFICIAL_RRB_HOSTS.has(host)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Normalizes any CEN representation into the canonical "CEN [RPF |RRC ]<NN>/<YYYY>" format.
 * Handles variants like "CEN No. 09/2026", "07/2026", "CEN 08/2026", or CENs inside full titles.
 */
export function normalizeCenNumber(rawValue: string | null | undefined): string | null {
  if (!rawValue) return null;
  let decoded = rawValue;
  try {
    decoded = decodeURIComponent(rawValue);
  } catch {
    return null;
  }
  const normalized = decoded.trim().toUpperCase().replace(/\s+/g, ' ');

  // Look for CEN pattern anywhere in string
  const match = normalized.match(
    /(?:(?:CEN|NOTICE|NOTIFICATION)\s*(?:NO\.?|NUMBER)?\s*)?(?:(RPF|RRC)\s+)?([A-Z0-9]+)\s*\/\s*(20\d{2})/i
  );
  if (!match) return null;

  const numPart = match[2];
  if (numPart.toUpperCase() === 'NO') {
    // If NO was captured as the number part due to trailing dot/spaces, re-match following NO
    const subMatch = normalized.match(/(?:NO\.?\s*)(?:(RPF|RRC)\s+)?([A-Z0-9]+)\s*\/\s*(20\d{2})/i);
    if (subMatch) {
      const p = subMatch[1] ? `${subMatch[1].toUpperCase()} ` : '';
      const n = /^\d+$/.test(subMatch[2]) ? subMatch[2].padStart(2, '0') : subMatch[2];
      return `CEN ${p}${n}/${subMatch[3]}`;
    }
    return null;
  }

  const prefix = match[1] ? `${match[1].toUpperCase()} ` : '';
  const number = /^\d+$/.test(numPart) ? numPart.padStart(2, '0') : numPart;
  return `CEN ${prefix}${number}/${match[3]}`;
}

function normalizeRrbDate(value: string | null | undefined): string | null {
  return normalizeDate(value);
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
    if (
      !notificationNumber ||
      !/detailed\s+centralised\s+employment\s+notification|विस्तृत केंद्रीकृत रोजगार अधिसूचना/i.test(description)
    ) {
      return;
    }

    const pdfOptions = $(cells[5])
      .find('option')
      .filter((__, option) => {
        const optionUrl = safeNavUrl($(option).attr('value'), pageUrl);
        return Boolean(optionUrl && /\.pdf(?:\/|$|\?)/i.test(new URL(optionUrl).pathname + new URL(optionUrl).search));
      });
    const englishOption = pdfOptions
      .filter((__, option) => /^english$/i.test($(option).text().trim()))
      .first();
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

/**
 * Builds a clean human-readable recruitment title from CEN and description.
 */
function buildRecruitmentTitle(cenNumber: string, rawDesc?: string | null): string {
  if (!rawDesc) return `RRB ${cenNumber} - Centralised Employment Notice`;

  const clean = rawDesc.replace(/\s+/g, ' ').trim();

  // Check for common post titles
  if (/isolated\s+categories/i.test(clean)) {
    return `RRB ${cenNumber} - Recruitment for Various Posts of Isolated Categories`;
  }
  if (/station\s+master/i.test(clean)) {
    return `RRB ${cenNumber} - Station Master`;
  }
  if (/non-technical\s+popular\s+categories|\(under\s+graduate\)|ntpc/i.test(clean)) {
    return `RRB ${cenNumber} - NTPC Undergraduate`;
  }

  // Strip prefixes like "CENTRALISED EMPLOYMENT NOTIFICATION (CEN) No. XX/XXXX"
  const stripped = clean
    .replace(/^.*?(?:CEN|NOTICE|NOTIFICATION)\s*(?:NO\.?)?\s*[0-9A-Z/]+\s*[-:—]?\s*/i, '')
    .trim();

  if (stripped.length > 4) {
    return `RRB ${cenNumber} - ${stripped}`;
  }

  return `RRB ${cenNumber} - Centralised Employment Notice`;
}

export class RRBCollector implements RecruitmentCollector {
  readonly organization = ORGANIZATION;
  public lastDiagnostics: CollectorDiagnostics | null = null;

  async collect(): Promise<RawRecruitmentItem[]> {
    console.log(`[RRB] Starting collection`);
    const discoveredAt = new Date().toISOString();
    const itemsMap = new Map<string, RawRecruitmentItem>();
    const diagnostics: CollectorDiagnostics = {
      sourcesAttempted: 0,
      sourcesAccessed: 0,
      sourcesFailed: 0,
      censDiscovered: 0,
      sourceDiagnostics: [],
    };

    // ─── 1. Primary Source: Official RRB Application Portal (rrbapply.gov.in) ────
    await this.collectFromApplyPortal(itemsMap, discoveredAt, diagnostics);

    // ─── 2. Secondary Sources: Regional & Central RRB Portals ───────────────────
    await this.collectFromRegionalPortals(itemsMap, discoveredAt, diagnostics);

    diagnostics.censDiscovered = itemsMap.size;
    this.lastDiagnostics = diagnostics;

    const items = Array.from(itemsMap.values());
    console.log(
      `[RRB] Collection completed: Discovered ${items.length} unique CEN recruitment notifications. ` +
        `Sources: ${diagnostics.sourcesAccessed} successful, ${diagnostics.sourcesFailed} failed.`
    );

    return items;
  }

  /**
   * Fetch active recruitment notifications from the official RRB application portal API.
   * Target endpoint: https://api.recruitmentrrb.in/api/Advertisement/WhatsNew
   */
  private async collectFromApplyPortal(
    itemsMap: Map<string, RawRecruitmentItem>,
    discoveredAt: string,
    diagnostics: CollectorDiagnostics
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    diagnostics.sourcesAttempted++;

    console.log(`[RRB] Fetching Official RRB Application Portal (${RRB_APPLY_PORTAL_URL})...`);
    try {
      const response = await httpClient.get(RRB_APPLY_API_URL, {
        headers: {
          Accept: 'application/json, text/plain, */*',
          Origin: 'https://www.rrbapply.gov.in',
          Referer: 'https://www.rrbapply.gov.in/',
        },
        timeout: 10_000,
      });

      if (response.status === 200 && response.data?.result && Array.isArray(response.data.result)) {
        diagnostics.sourcesAccessed++;
        diagnostics.sourceDiagnostics.push({
          name: 'RRB Apply Portal API',
          url: RRB_APPLY_PORTAL_URL,
          status: 'success',
          httpStatus: 200,
          timestamp,
        });

        for (const adv of response.data.result) {
          const rawCen = adv.advertisementNumber || adv.description;
          const cenNumber = normalizeCenNumber(rawCen);
          if (!cenNumber) continue;

          // Prefer English notices; if this is a custom/Hindi duplicate and we already have English, skip
          const isHindiNotice = Boolean(
            adv.isFromCustomNotice ||
              /hindi/i.test(adv.description || '') ||
              /hindi\.pdf/i.test(adv.documentUrl || '')
          );
          if (itemsMap.has(cenNumber) && isHindiNotice) {
            continue;
          }

          const rawDesc = String(adv.description || '').replace(/\s+/g, ' ').trim();
          const title = buildRecruitmentTitle(cenNumber, rawDesc);

          const appStart = normalizeDate(adv.startDate);
          const appEnd = normalizeDate(adv.endDate);
          const notifDate = normalizeDate(adv.publishDate) || appStart;

          const pdfUrl = adv.documentUrl ? safeNavUrl(adv.documentUrl, RRB_APPLY_PORTAL_URL) : null;
          const pageUrl = RRB_APPLY_PORTAL_URL;

          const contentFields = {
            organization: ORGANIZATION,
            notification_number: cenNumber,
            title,
            notification_date: notifDate,
            application_start: appStart,
            application_end: appEnd,
          };

          itemsMap.set(cenNumber, {
            organization: ORGANIZATION,
            title,
            notification_number: cenNumber,
            recruitment_type: 'recruitment_notification',
            description: rawDesc || `Centralised Employment Notice (${cenNumber}) on official RRB portal.`,
            vacancies: null,
            notification_date: notifDate,
            application_start: appStart,
            application_end: appEnd,
            exam_date: null,
            official_page_url: pageUrl,
            official_pdf_url: pdfUrl,
            source_url: RRB_APPLY_PORTAL_URL,
            source_document_url: RRB_APPLY_PORTAL_URL,
            discovered_at: discoveredAt,
            raw_text: JSON.stringify(adv),
            content_hash: sha256(buildContentString(contentFields)),
            min_age: null,
            max_age: null,
            fee: null,
          });

          console.log(
            `[RRB] Discovered active portal recruitment: ${cenNumber} - ${title} ` +
              `(Opening: ${appStart}, Closing: ${appEnd})`
          );
        }
      } else {
        throw new Error(`Unexpected response structure: HTTP ${response.status}`);
      }
    } catch (err: any) {
      const errorMsg = err.response ? `HTTP ${err.response.status}` : err.message;
      console.warn(`[RRB] [${timestamp}] Failed source: RRB Apply Portal (${RRB_APPLY_PORTAL_URL}) - ${errorMsg}`);
      diagnostics.sourcesFailed++;
      diagnostics.sourceDiagnostics.push({
        name: 'RRB Apply Portal API',
        url: RRB_APPLY_PORTAL_URL,
        status: 'failed',
        httpStatus: err.response?.status,
        error: errorMsg,
        timestamp,
      });
    }
  }

  /**
   * Concurrently check configured regional RRB portals.
   * Failures on individual regional sites are logged and do not stop processing.
   */
  private async collectFromRegionalPortals(
    itemsMap: Map<string, RawRecruitmentItem>,
    discoveredAt: string,
    diagnostics: CollectorDiagnostics
  ): Promise<void> {
    const notificationPages = new Map<string, Map<string, { url: string; referer: string }>>();
    const concurrency = 4;
    let index = 0;

    const workers = Array.from({ length: concurrency }, async () => {
      while (index < RRB_OFFICIAL_PORTALS.length) {
        const portal = RRB_OFFICIAL_PORTALS[index++];
        const timestamp = new Date().toISOString();
        diagnostics.sourcesAttempted++;

        try {
          console.log(`[RRB] Fetching ${portal.name} (${portal.url})...`);
          const response = await httpClient.get(portal.url, { timeout: 6_000 });
          diagnostics.sourcesAccessed++;
          diagnostics.sourceDiagnostics.push({
            name: portal.name,
            url: portal.url,
            status: 'success',
            httpStatus: response.status,
            timestamp,
          });

          const $ = cheerio.load(response.data);
          const responseUrl = response.request?.res?.responseUrl || portal.url;

          $('a[href*="cennum"], a[href*="cenum"], a[href*="CEN"], a[href*="cen"]').each((_, el) => {
            const href = $(el).attr('href') || '';
            const rawText = $(el).text().trim().replace(/\s+/g, ' ');

            let rawCenCode: string | null = null;
            try {
              const linkUrl = new URL(href, responseUrl);
              rawCenCode = linkUrl.searchParams.get('cennum') || linkUrl.searchParams.get('cenum');
            } catch {
              rawCenCode = null;
            }

            const textMatch = rawText.match(/CEN\s*(?:NO\.?|NUMBER)?\s*([A-Z0-9/\s-]+)/i);
            const notificationNumber = normalizeCenNumber(rawCenCode || textMatch?.[1] || rawText);
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
              const cenPages =
                notificationPages.get(notificationNumber) ??
                new Map<string, { url: string; referer: string }>();
              cenPages.set(pageUrl, { url: pageUrl, referer: responseUrl });
              notificationPages.set(notificationNumber, cenPages);
            }

            const dateMatch = rawText.match(/([0-9]{2}[\.\/\-][0-9]{2}[\.\/\-][0-9]{4})/);
            const rawNotifDate = dateMatch ? dateMatch[1] : null;
            const normalizedNotifDate = rawNotifDate ? normalizeDate(rawNotifDate) : null;

            const title = `RRB ${notificationNumber} - Centralised Employment Notice`;
            const pdfUrl = /\.pdf(?:$|\?)/i.test(href) ? safeNavUrl(href, responseUrl) : null;

            // If already discovered (e.g. from the official apply portal), retain its richer fields
            if (itemsMap.has(notificationNumber)) {
              const existing = itemsMap.get(notificationNumber)!;
              if (!existing.official_pdf_url && pdfUrl) {
                existing.official_pdf_url = pdfUrl;
              }
              if (!existing.notification_date && normalizedNotifDate) {
                existing.notification_date = normalizedNotifDate;
              }
              return;
            }

            const contentFields = {
              organization: ORGANIZATION,
              notification_number: notificationNumber,
              title,
              notification_date: normalizedNotifDate || null,
            };

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
              source_url: RRB_CENTRAL_URL,
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
          const errorMsg = err.code || (err.response ? `HTTP ${err.response.status}` : err.message);
          console.warn(`[RRB] [${timestamp}] Failed source: ${portal.name} (${portal.url}) - Status/Error: ${errorMsg}`);
          diagnostics.sourcesFailed++;
          diagnostics.sourceDiagnostics.push({
            name: portal.name,
            url: portal.url,
            status: 'failed',
            httpStatus: err.response?.status,
            error: errorMsg,
            timestamp,
          });
        }
      }
    });

    await Promise.all(workers);

    // Fetch any detailed regional notification pages found
    const pages = [...notificationPages.values()].flatMap((cenPages) => [...cenPages.values()]);
    if (pages.length > 0) {
      const pageDocuments = await fetchNotificationPages(pages);
      for (const document of pageDocuments) {
        const item = itemsMap.get(document.notification_number);
        if (!item) continue;
        if (!item.official_pdf_url) item.official_pdf_url = document.official_pdf_url;
        if (!item.notification_date) item.notification_date = document.notification_date;
        if (!item.official_page_url) item.official_page_url = pages[0]?.url ?? null;
      }
    }
  }
}

async function fetchNotificationPages(
  pages: Array<{ url: string; referer: string }>
): Promise<RrbNotificationDocument[]> {
  const documents: RrbNotificationDocument[] = [];
  let nextIndex = 0;
  const workerCount = Math.min(4, pages.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < pages.length) {
        const page = pages[nextIndex++];
        try {
          const response = await httpClient.get(page.url, {
            headers: { Referer: page.referer },
            timeout: 6_000,
          });
          documents.push(
            ...parseRrbNotificationDocuments(
              String(response.data),
              response.request?.res?.responseUrl || page.url
            )
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.warn(`[RRB] Could not inspect official notification page ${page.url}: ${message}`);
        }
      }
    })
  );

  return [...new Map(documents.map((document) => [document.notification_number, document])).values()];
}

export const rrbCollector = new RRBCollector();
