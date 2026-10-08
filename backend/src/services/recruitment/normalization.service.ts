import { createHash } from 'crypto';

/**
 * Generate a deterministic SHA-256 hash from any string content.
 * Used to detect when source content has changed between runs.
 */
export function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Normalize a date string to ISO YYYY-MM-DD format.
 * Returns null if the value is falsy or unparseable.
 */
export function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
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
