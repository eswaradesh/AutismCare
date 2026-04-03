-- Migration: Create routine entries table
-- Run this FOURTH in Supabase SQL Editor

-- Create routine type enum
CREATE TYPE public.routine_type AS ENUM ('sleep', 'food', 'activity', 'therapy');

CREATE TABLE public.routine_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    child_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    type routine_type NOT NULL,
    start_time TIME,
    end_time TIME,
    notes TEXT,
    voice_note_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.routine_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own routine entries"
ON public.routine_entries FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own routine entries"
ON public.routine_entries FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own routine entries"
ON public.routine_entries FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own routine entries"
ON public.routine_entries FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Update trigger
CREATE TRIGGER update_routine_entries_updated_at
    BEFORE UPDATE ON public.routine_entries
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for faster queries
CREATE INDEX idx_routine_entries_user_id ON public.routine_entries(user_id);
CREATE INDEX idx_routine_entries_date ON public.routine_entries(date);
CREATE INDEX idx_routine_entries_child_id ON public.routine_entries(child_id);
