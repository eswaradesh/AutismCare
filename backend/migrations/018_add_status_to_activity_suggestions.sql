-- Migration: Add status column to therapist_activity_suggestions
-- Run this in Supabase SQL Editor

ALTER TABLE public.therapist_activity_suggestions 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
