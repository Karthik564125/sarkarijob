// Types for recruitment architecture tables

export type SourceType = 'listing_page' | 'notification_page' | 'pdf' | 'regional_board' | string;

export interface RecruitmentSource {
  id: string;
  organization: string;
  source_name: string;
  source_url: string;
  source_type: SourceType;
  active: boolean;
  last_checked_at: string | null;
  last_content_hash: string | null;
  created_at: string;
  updated_at: string;
}

export type RecruitmentStatus = 'upcoming' | 'open' | 'closing_soon' | 'closed' | 'cancelled' | string;

export interface EligibilityEducation {
  minimum_level?: string;
  degrees?: string[];
  branches?: string[];
}

export interface EligibilityAge {
  minimum?: number;
  maximum?: number;
}

export interface EligibilityRules {
  education?: EligibilityEducation;
  age?: EligibilityAge;
  categories?: string[];
  gender?: string;
  domicile?: string[];
  experience_required?: boolean;
  [key: string]: unknown;
}

export interface Recruitment {
  id: string;
  organization: string;
  title: string;
  notification_number: string | null;
  recruitment_type: string | null;
  description: string | null;
  vacancies: number | null;
  notification_date: string | null;
  application_start: string | null;
  application_end: string | null;
  exam_date: string | null;
  official_page_url: string | null;
  official_pdf_url: string | null;
  status: RecruitmentStatus;
  eligibility_rules: EligibilityRules | null;
  content_hash: string | null;
  last_seen_at: string | null;
  last_changed_at: string | null;
  extraction_status: string;
  extraction_model: string | null;
  extraction_version: string | null;
  extracted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type EventType =
  | 'notification'
  | 'corrigendum'
  | 'application_open'
  | 'application_extended'
  | 'application_deadline_changed'
  | 'exam_date_changed'
  | 'admit_card'
  | 'answer_key'
  | 'result'
  | 'other'
  | string;

export interface RecruitmentEvent {
  id: string;
  recruitment_id: string;
  event_type: EventType;
  title: string;
  description: string | null;
  official_url: string | null;
  event_date: string | null;
  content_hash: string | null;
  created_at: string;
}

export type DocumentType =
  | 'notification_pdf'
  | 'corrigendum_pdf'
  | 'syllabus_pdf'
  | 'exam_notice_pdf'
  | 'admit_card_notice'
  | 'result_pdf'
  | string;

export interface RecruitmentDocument {
  id: string;
  recruitment_id: string;
  document_type: DocumentType;
  title: string | null;
  official_url: string;
  content_hash: string | null;
  fetched_at: string | null;
  published_at: string | null;
  extraction_status: string;
  extraction_model: string | null;
  extraction_version: string | null;
  extracted_at: string | null;
  created_at: string;
}
