-- Migration: Add report_data to shared_reports for persistent sharing
-- Run this after 009_create_shared_reports.sql

ALTER TABLE public.shared_reports 
ADD COLUMN IF NOT EXISTS report_data JSONB;

-- Note: In the future, we could also add 'report_type' if needed, 
-- but 'report_data' covers the current behavioral report structure.
