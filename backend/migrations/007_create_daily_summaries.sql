-- Migration: Create daily summaries table
-- Run this SEVENTH in Supabase SQL Editor

CREATE TABLE public.daily_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    child_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    sleep_quality TEXT,
    mood_overview TEXT,
    highlights TEXT[], -- Array of highlight strings
    positive_notes TEXT,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, child_id, date)
);

-- Enable RLS
ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own daily summaries"
ON public.daily_summaries FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily summaries"
ON public.daily_summaries FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily summaries"
ON public.daily_summaries FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own daily summaries"
ON public.daily_summaries FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Update trigger
CREATE TRIGGER update_daily_summaries_updated_at
    BEFORE UPDATE ON public.daily_summaries
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_daily_summaries_user_id ON public.daily_summaries(user_id);
CREATE INDEX idx_daily_summaries_date ON public.daily_summaries(date);
CREATE INDEX idx_daily_summaries_child_id ON public.daily_summaries(child_id);
