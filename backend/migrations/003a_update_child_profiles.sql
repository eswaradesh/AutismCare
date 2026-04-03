-- Migration: Update child_profiles table to add missing columns
-- Run this AFTER 003_create_child_profiles.sql if you already ran the original migration
-- This adds the missing columns: age_years, age_months, communication_level, sensory_preference

-- Create communication level enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE public.communication_level AS ENUM ('verbal', 'nonVerbal', 'limited', 'developing');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create sensory preference enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE public.sensory_preference AS ENUM ('seeking', 'avoiding', 'mixed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add age_years column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'child_profiles' 
                   AND column_name = 'age_years') THEN
        ALTER TABLE public.child_profiles ADD COLUMN age_years INTEGER DEFAULT 0;
    END IF;
END $$;

-- Add age_months column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'child_profiles' 
                   AND column_name = 'age_months') THEN
        ALTER TABLE public.child_profiles ADD COLUMN age_months INTEGER DEFAULT 0;
    END IF;
END $$;

-- Add communication_level column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'child_profiles' 
                   AND column_name = 'communication_level') THEN
        ALTER TABLE public.child_profiles ADD COLUMN communication_level communication_level DEFAULT 'developing';
    END IF;
END $$;

-- Add sensory_preference column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'child_profiles' 
                   AND column_name = 'sensory_preference') THEN
        ALTER TABLE public.child_profiles ADD COLUMN sensory_preference sensory_preference DEFAULT 'mixed';
    END IF;
END $$;
