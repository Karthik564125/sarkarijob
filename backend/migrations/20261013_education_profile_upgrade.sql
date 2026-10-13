-- =============================================================================
-- Migration: 20261013_education_profile_upgrade.sql
-- Description: Add structured fields for 10th, 12th, and Graduation education,
--              maintaining full backward compatibility with existing data.
-- Run this in the Supabase SQL Editor.
-- =============================================================================

-- 1. education_10th: add board_other and percentage_or_cgpa
ALTER TABLE education_10th ADD COLUMN IF NOT EXISTS board_other TEXT;
ALTER TABLE education_10th ADD COLUMN IF NOT EXISTS percentage_or_cgpa TEXT;

-- Backfill percentage_or_cgpa from percentage for existing rows
UPDATE education_10th
SET percentage_or_cgpa = percentage
WHERE percentage_or_cgpa IS NULL AND percentage IS NOT NULL;

-- 2. education_12th: add board_other, stream_other, college_name, percentage_or_cgpa, subjects
ALTER TABLE education_12th ADD COLUMN IF NOT EXISTS board_other TEXT;
ALTER TABLE education_12th ADD COLUMN IF NOT EXISTS stream_other TEXT;
ALTER TABLE education_12th ADD COLUMN IF NOT EXISTS college_name TEXT;
ALTER TABLE education_12th ADD COLUMN IF NOT EXISTS percentage_or_cgpa TEXT;
ALTER TABLE education_12th ADD COLUMN IF NOT EXISTS subjects TEXT[] DEFAULT '{}';

-- Backfill college_name and percentage_or_cgpa from existing columns
UPDATE education_12th
SET college_name = school_college_name
WHERE college_name IS NULL AND school_college_name IS NOT NULL;

UPDATE education_12th
SET percentage_or_cgpa = percentage
WHERE percentage_or_cgpa IS NULL AND percentage IS NOT NULL;

-- 3. education_graduation: add degree_other, branch_other, college_name
ALTER TABLE education_graduation ADD COLUMN IF NOT EXISTS degree_other TEXT;
ALTER TABLE education_graduation ADD COLUMN IF NOT EXISTS branch_other TEXT;
ALTER TABLE education_graduation ADD COLUMN IF NOT EXISTS college_name TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_education_10th_user_id ON education_10th(user_id);
CREATE INDEX IF NOT EXISTS idx_education_12th_user_id ON education_12th(user_id);
CREATE INDEX IF NOT EXISTS idx_education_graduation_user_id ON education_graduation(user_id);
