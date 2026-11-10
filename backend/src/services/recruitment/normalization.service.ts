import { createHash } from 'crypto';

/**
 * Generate a deterministic SHA-256 hash from any string content.
 * Used to detect when source content has changed between runs.
 */
export function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Get the current calendar date string (YYYY-MM-DD) in Asia/Kolkata timezone.
 */
export function getKolkataDateString(d: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d);
}

/**
 * Normalize a date string to ISO YYYY-MM-DD format.
 * Correctly parses DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, YYYY-MM-DD, and ISO timestamps.
 * Returns null if the value is falsy or unparseable.
 */
export function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const str = String(value).trim();
  if (!str || str.toLowerCase() === 'null') return null;

  // 1. Check DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (ddmmyyyy) {
    const day = parseInt(ddmmyyyy[1], 10);
    const month = parseInt(ddmmyyyy[2], 10);
    const year = parseInt(ddmmyyyy[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${year}-${pad(month)}-${pad(day)}`;
    }
  }

  // 2. Check YYYY-MM-DD or YYYY/MM/DD or ISO timestamp starting with YYYY-MM-DD
  const yyyymmdd = str.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (yyyymmdd) {
    const year = parseInt(yyyymmdd[1], 10);
    const month = parseInt(yyyymmdd[2], 10);
    const day = parseInt(yyyymmdd[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${year}-${pad(month)}-${pad(day)}`;
    }
  }

  // 3. Fallback to standard Date parsing
  const d = new Date(str);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

/**
 * Coerce a value to a positive integer.
 * Returns null if invalid.
 */
export function toPositiveInt(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

/**
 * Build a content string suitable for hashing from a raw item.
 * Only uses stable fields (not timestamps / discovered_at).
 */
export function buildContentString(fields: Record<string, unknown>): string {
  return JSON.stringify(fields, Object.keys(fields).sort());
}

export function normalizeRecruitmentTitle(title: string | null | undefined): string {
  return (title ?? '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '');
}
