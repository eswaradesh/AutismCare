-- Migration: Create behavior entries table
-- Run this FIFTH in Supabase SQL Editor

-- Create intensity enum
CREATE TYPE public.intensity_level AS ENUM ('low', 'moderate', 'high');

CREATE TABLE public.behavior_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    child_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    emotion TEXT NOT NULL,
    intensity intensity_level NOT NULL DEFAULT 'moderate',
    trigger TEXT,
    notes TEXT,
    is_sudden BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.behavior_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own behavior entries"
ON public.behavior_entries FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own behavior entries"
ON public.behavior_entries FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own behavior entries"
ON public.behavior_entries FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own behavior entries"
ON public.behavior_entries FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Update trigger
CREATE TRIGGER update_behavior_entries_updated_at
    BEFORE UPDATE ON public.behavior_entries
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_behavior_entries_user_id ON public.behavior_entries(user_id);
CREATE INDEX idx_behavior_entries_date ON public.behavior_entries(date);
CREATE INDEX idx_behavior_entries_child_id ON public.behavior_entries(child_id);
