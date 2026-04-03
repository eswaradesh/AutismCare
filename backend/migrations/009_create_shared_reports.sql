-- Migration: Create shared reports table for sharing with caregivers/doctors
-- Run this NINTH in Supabase SQL Editor

CREATE TABLE public.shared_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    child_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE,
    share_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    title TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    include_routines BOOLEAN DEFAULT TRUE,
    include_behaviors BOOLEAN DEFAULT TRUE,
    include_medications BOOLEAN DEFAULT TRUE,
    include_summaries BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.shared_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for owners
CREATE POLICY "Users can view own shared reports"
ON public.shared_reports FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own shared reports"
ON public.shared_reports FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shared reports"
ON public.shared_reports FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own shared reports"
ON public.shared_reports FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Public access policy for viewing shared reports via token (anonymous access)
CREATE POLICY "Anyone can view active shared reports via token"
ON public.shared_reports FOR SELECT
TO anon
USING (
    is_active = TRUE 
    AND (expires_at IS NULL OR expires_at > NOW())
);

-- Function to increment view count
CREATE OR REPLACE FUNCTION public.increment_report_view_count(report_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.shared_reports
    SET view_count = view_count + 1
    WHERE share_token = report_token
      AND is_active = TRUE
      AND (expires_at IS NULL OR expires_at > NOW());
END;
$$;

-- Update trigger
CREATE TRIGGER update_shared_reports_updated_at
    BEFORE UPDATE ON public.shared_reports
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_shared_reports_user_id ON public.shared_reports(user_id);
CREATE INDEX idx_shared_reports_token ON public.shared_reports(share_token);
CREATE INDEX idx_shared_reports_child_id ON public.shared_reports(child_id);
