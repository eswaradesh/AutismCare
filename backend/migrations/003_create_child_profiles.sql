-- Migration: Create child profiles table
-- Run this THIRD in Supabase SQL Editor

-- Create communication level enum
CREATE TYPE public.communication_level AS ENUM ('verbal', 'nonVerbal', 'limited', 'developing');

-- Create sensory preference enum
CREATE TYPE public.sensory_preference AS ENUM ('seeking', 'avoiding', 'mixed');

CREATE TABLE public.child_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    age_years INTEGER DEFAULT 0,
    age_months INTEGER DEFAULT 0,
    date_of_birth DATE,
    communication_level communication_level DEFAULT 'developing',
    sensory_preference sensory_preference DEFAULT 'mixed',
    diagnosis TEXT,
    notes TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.child_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own child profiles"
ON public.child_profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own child profiles"
ON public.child_profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own child profiles"
ON public.child_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own child profiles"
ON public.child_profiles FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Update trigger
CREATE TRIGGER update_child_profiles_updated_at
    BEFORE UPDATE ON public.child_profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster queries
CREATE INDEX idx_child_profiles_user_id ON public.child_profiles(user_id);
