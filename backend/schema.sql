-- ==========================================================
-- SarkariJob Database Schema
-- Run this in the Supabase SQL Editor
-- ==========================================================

-- A. users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- B. user_profiles (one profile per user)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT,
  date_of_birth DATE,
  gender TEXT,
  state_of_domicile TEXT,
  reservation_category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- C. education_10th
CREATE TABLE IF NOT EXISTS education_10th (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_name TEXT,
  board TEXT,
  passing_year INTEGER,
  percentage TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- D. education_12th
CREATE TABLE IF NOT EXISTS education_12th (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_college_name TEXT,
  board TEXT,
  stream TEXT,
  passing_year INTEGER,
  percentage TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- E. education_graduation
CREATE TABLE IF NOT EXISTS education_graduation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  degree TEXT,
  branch TEXT,
  university TEXT,
  passing_year INTEGER,
  percentage_or_cgpa TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================================
-- Trigger: auto-update updated_at on row change
-- ==========================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER education_10th_updated_at
  BEFORE UPDATE ON education_10th
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER education_12th_updated_at
  BEFORE UPDATE ON education_12th
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER education_graduation_updated_at
  BEFORE UPDATE ON education_graduation
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================================
-- Row Level Security (RLS) — disable direct public mutation for user tables
-- Backend uses service-role key and bypasses RLS
-- ==========================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE education_10th ENABLE ROW LEVEL SECURITY;
ALTER TABLE education_12th ENABLE ROW LEVEL SECURITY;
ALTER TABLE education_graduation ENABLE ROW LEVEL SECURITY;

-- ==========================================================
-- RECRUITMENT DATA ARCHITECTURE
-- ==========================================================

-- 1. recruitment_sources
CREATE TABLE IF NOT EXISTS recruitment_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_checked_at TIMESTAMPTZ,
  last_content_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT recruitment_sources_org_url_key UNIQUE (organization, source_url)
);

-- 2. recruitments
CREATE TABLE IF NOT EXISTS recruitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization TEXT NOT NULL,
  title TEXT NOT NULL,
  notification_number TEXT,
  recruitment_type TEXT,
  description TEXT,
  vacancies INTEGER,
  notification_date DATE,
  application_start DATE,
  application_end DATE,
  exam_date DATE,
  official_page_url TEXT,
  official_pdf_url TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming',
  eligibility_rules JSONB,
  content_hash TEXT,
  last_seen_at TIMESTAMPTZ,
  last_changed_at TIMESTAMPTZ,
  extraction_status TEXT DEFAULT 'pending',
  extraction_model TEXT,
  extraction_version TEXT,
  extracted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT recruitments_org_notif_num_key UNIQUE (organization, notification_number)
);

-- User-specific manual application decisions; independent of eligibility matches.
CREATE TABLE IF NOT EXISTS user_recruitment_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recruitment_id UUID NOT NULL REFERENCES recruitments(id) ON DELETE CASCADE,
  application_status TEXT NOT NULL CHECK (application_status IN ('applied', 'not_applied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_recruitment_applications_user_recruitment_key UNIQUE (user_id, recruitment_id)
);

CREATE INDEX IF NOT EXISTS idx_user_recruitment_applications_user_id
  ON user_recruitment_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_recruitment_applications_recruitment_id
  ON user_recruitment_applications(recruitment_id);
CREATE INDEX IF NOT EXISTS idx_user_recruitment_applications_status
  ON user_recruitment_applications(application_status);
CREATE INDEX IF NOT EXISTS idx_user_recruitment_applications_user_status
  ON user_recruitment_applications(user_id, application_status);

-- 3. recruitment_events
CREATE TABLE IF NOT EXISTS recruitment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruitment_id UUID NOT NULL REFERENCES recruitments(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  official_url TEXT,
  event_date DATE,
  content_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT recruitment_events_unique_event UNIQUE (recruitment_id, event_type, content_hash)
);

-- 4. recruitment_documents
CREATE TABLE IF NOT EXISTS recruitment_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruitment_id UUID NOT NULL REFERENCES recruitments(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  title TEXT,
  official_url TEXT NOT NULL,
  content_hash TEXT,
  fetched_at TIMESTAMPTZ,
  published_at DATE,
  extraction_status TEXT DEFAULT 'pending',
  extraction_model TEXT,
  extraction_version TEXT,
  extracted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT recruitment_documents_unique_doc UNIQUE (recruitment_id, official_url)
);

-- ==========================================================
-- INDEXES
-- ==========================================================

-- recruitments indexes
CREATE INDEX IF NOT EXISTS idx_recruitments_organization ON recruitments(organization);
CREATE INDEX IF NOT EXISTS idx_recruitments_status ON recruitments(status);
CREATE INDEX IF NOT EXISTS idx_recruitments_application_start ON recruitments(application_start);
CREATE INDEX IF NOT EXISTS idx_recruitments_application_end ON recruitments(application_end);
CREATE INDEX IF NOT EXISTS idx_recruitments_notification_date ON recruitments(notification_date);
CREATE INDEX IF NOT EXISTS idx_recruitments_last_seen_at ON recruitments(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_recruitments_open_jobs ON recruitments(status, application_start, application_end) WHERE status IN ('open', 'closing_soon');

-- recruitment_events indexes
CREATE INDEX IF NOT EXISTS idx_recruitment_events_recruitment_id ON recruitment_events(recruitment_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_events_event_type ON recruitment_events(event_type);
CREATE INDEX IF NOT EXISTS idx_recruitment_events_event_date ON recruitment_events(event_date);

-- recruitment_documents indexes
CREATE INDEX IF NOT EXISTS idx_recruitment_documents_recruitment_id ON recruitment_documents(recruitment_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_documents_document_type ON recruitment_documents(document_type);

-- recruitment_sources indexes
CREATE INDEX IF NOT EXISTS idx_recruitment_sources_organization ON recruitment_sources(organization);
CREATE INDEX IF NOT EXISTS idx_recruitment_sources_active ON recruitment_sources(active);

-- ==========================================================
-- TRIGGERS FOR UPDATED_AT
-- ==========================================================

DROP TRIGGER IF EXISTS recruitment_sources_updated_at ON recruitment_sources;
CREATE TRIGGER recruitment_sources_updated_at
  BEFORE UPDATE ON recruitment_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS recruitments_updated_at ON recruitments;
CREATE TRIGGER recruitments_updated_at
  BEFORE UPDATE ON recruitments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS user_recruitment_applications_updated_at ON user_recruitment_applications;
CREATE TRIGGER user_recruitment_applications_updated_at
  BEFORE UPDATE ON user_recruitment_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================================
-- INITIAL OFFICIAL SOURCES
-- ==========================================================

INSERT INTO recruitment_sources (organization, source_name, source_url, source_type, active)
VALUES
  ('SSC', 'SSC Official Website', 'https://ssc.gov.in/', 'listing_page', true),
  ('APPSC', 'APPSC Official Website', 'https://psc.ap.gov.in/', 'listing_page', true),
  ('RRB', 'RRB Official Website', 'https://www.rrb.gov.in/', 'listing_page', true)
ON CONFLICT (organization, source_url) DO UPDATE SET
  source_name = EXCLUDED.source_name,
  source_type = EXCLUDED.source_type,
  active = EXCLUDED.active,
  updated_at = NOW();

-- ==========================================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================================

ALTER TABLE recruitment_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruitment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruitment_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_recruitment_applications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read access on recruitment_sources') THEN
    CREATE POLICY "Allow public read access on recruitment_sources" ON recruitment_sources FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read access on recruitments') THEN
    CREATE POLICY "Allow public read access on recruitments" ON recruitments FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read access on recruitment_events') THEN
    CREATE POLICY "Allow public read access on recruitment_events" ON recruitment_events FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read access on recruitment_documents') THEN
    CREATE POLICY "Allow public read access on recruitment_documents" ON recruitment_documents FOR SELECT USING (true);
  END IF;
END $$;
