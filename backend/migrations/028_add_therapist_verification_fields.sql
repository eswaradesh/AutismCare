-- Add verified_at and verified_by columns to therapist_profiles
ALTER TABLE therapist_profiles ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;
ALTER TABLE therapist_profiles ADD COLUMN IF NOT EXISTS verified_by TEXT;
