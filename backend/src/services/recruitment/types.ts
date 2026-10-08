/**
 * Internal normalized type for a recruitment item discovered from an official source.
 * Fields may be null/undefined when not reliably available from the source.
 */
export interface RawRecruitmentItem {
  organization: string;
  title: string;
  notification_number: string | null;
  recruitment_type: string | null;
  description: string | null;
  vacancies: number | null;
  notification_date: string | null;       // ISO date string YYYY-MM-DD
  application_start: string | null;       // ISO date string YYYY-MM-DD
  application_end: string | null;         // ISO date string YYYY-MM-DD or ISO datetime
  exam_date: string | null;              // ISO date string YYYY-MM-DD
  official_page_url: string | null;
  official_pdf_url: string | null;
  document_type?: string;
  source_url: string;
  source_document_url: string | null;
  document_published_at?: string | null;
  discovered_at: string;                  // ISO datetime
  raw_text: string | null;
  content_hash: string;
  // Age info extracted at collection time if available
  min_age: number | null;
  max_age: number | null;
  // Fee info if available
  fee: string | null;
}

/**
 * Result returned by the collector after processing.
 */
export interface CollectionResult {
  organization: string;
  success: boolean;
  discovered: number;
  new: number;
  updated: number;
  unchanged: number;
  documents: number;
  errors: string[];
}
