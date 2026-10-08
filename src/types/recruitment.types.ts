// Phase 8 — Recruitment types matching the Phase 7 backend API responses

export type EligibilityStatus = 'eligible' | 'verify' | 'not_eligible';
export type ApplicationStatus = 'applied' | 'not_applied';
export type RecruitmentStatus = 'open' | 'closing_soon' | 'upcoming' | 'closed' | 'cancelled';
export type Organization = 'SSC' | 'APPSC' | 'RRB';

export interface RecruitmentSummary {
  id: string;
  organization: Organization;
  title: string;
  notification_number: string | null;
  recruitment_type: string | null;
  vacancies: number | null;
  notification_date: string | null;
  application_start: string | null;
  application_end: string | null;
  exam_date: string | null;
  official_page_url: string | null;
  official_pdf_url: string | null;
  status: RecruitmentStatus;
  last_changed_at: string | null;
}

export interface RecruitmentDetail extends RecruitmentSummary {
  eligibility_rules: Record<string, unknown> | null;
  source_url: string | null;
  created_at: string;
}

export interface UserMatch {
  id: string;
  eligibility_status: EligibilityStatus;
  reasons: string[];
  matched_criteria: string[];
  unmet_criteria: string[];
  unknown_criteria: string[];
  evaluated_at: string;
  recruitments: RecruitmentSummary;
}

export interface RecruitmentEvent {
  id: string;
  recruitment_id: string;
  event_type: string;
  title: string;
  description: string | null;
  official_url: string | null;
  event_date: string | null;
  created_at: string;
  recruitments: {
    id?: string;
    title: string;
    organization: string;
    notification_number: string | null;
    notification_date?: string | null;
    application_start?: string | null;
    application_end?: string | null;
    status?: string | null;
  };
  eligibility?: { status: EligibilityStatus | null };
  application?: { status: ApplicationStatus | null };
}

export interface UserApplicationRecord {
  id: string;
  recruitment_id: string;
  application_status: ApplicationStatus;
  created_at: string;
  updated_at: string;
  recruitments: {
    id: string;
    organization: string;
    title: string;
    notification_number: string | null;
    application_end: string | null;
    status: string;
    official_page_url: string | null;
  };
}

// API response shapes

export interface DashboardSummary {
  eligible: number;
  verify: number;
  notEligible: number;
  open: number;
  closingSoon: number;
  upcoming: number;
  recentChanges: number;
}

export interface MatchesResponse {
  total: number;
  matches: UserMatch[];
}

export interface RelevantRecruitmentsResponse {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  recruitments: UserMatch[];
}

export interface EventsResponse {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  events: RecruitmentEvent[];
}

export interface RecruitmentDetailResponse {
  recruitment: RecruitmentDetail;
  userMatch: Omit<UserMatch, 'recruitments'> | null;
  events: Omit<RecruitmentEvent, 'recruitments'>[];
}
