-- Migration: Create medications table
-- Run this SIXTH in Supabase SQL Editor

-- Create frequency enum
CREATE TYPE public.medication_frequency AS ENUM ('daily', 'twice-daily', 'as-needed');

CREATE TABLE public.medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    child_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    dosage TEXT,
    time TIME,
    frequency medication_frequency NOT NULL DEFAULT 'daily',
    notes TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own medications"
ON public.medications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own medications"
ON public.medications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own medications"
ON public.medications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own medications"
ON public.medications FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Update trigger
CREATE TRIGGER update_medications_updated_at
    BEFORE UPDATE ON public.medications
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_medications_user_id ON public.medications(user_id);
CREATE INDEX idx_medications_child_id ON public.medications(child_id);
