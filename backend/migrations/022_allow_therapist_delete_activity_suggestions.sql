-- Migration: Allow therapists to delete their own activity suggestions
-- Run this after 013_create_therapist_alerts_and_suggestions.sql

DROP POLICY IF EXISTS "Therapists can delete their suggestions" ON public.therapist_activity_suggestions;

CREATE POLICY "Therapists can delete their suggestions"
ON public.therapist_activity_suggestions FOR DELETE
TO authenticated
USING (auth.uid() = therapist_id);
