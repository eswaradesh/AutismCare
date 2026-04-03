-- Migration: Grant therapists read access to shared child data
-- Run this after therapist relationship migrations are applied

-- Routine entries: therapist can read when relationship is accepted and routine access is enabled.
DROP POLICY IF EXISTS "Therapists can view shared routine entries" ON public.routine_entries;
CREATE POLICY "Therapists can view shared routine entries"
ON public.routine_entries FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.parent_therapist_relationships ptr
    WHERE ptr.child_id = routine_entries.child_id
      AND ptr.therapist_id = auth.uid()
      AND ptr.status = 'accepted'
      AND COALESCE(ptr.access_routines, TRUE) = TRUE
      AND (ptr.access_expires_at IS NULL OR ptr.access_expires_at > NOW())
  )
);

-- Behavior entries: therapist can read when relationship is accepted and behavior access is enabled.
DROP POLICY IF EXISTS "Therapists can view shared behavior entries" ON public.behavior_entries;
CREATE POLICY "Therapists can view shared behavior entries"
ON public.behavior_entries FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.parent_therapist_relationships ptr
    WHERE ptr.child_id = behavior_entries.child_id
      AND ptr.therapist_id = auth.uid()
      AND ptr.status = 'accepted'
      AND COALESCE(ptr.access_behaviors, TRUE) = TRUE
      AND (ptr.access_expires_at IS NULL OR ptr.access_expires_at > NOW())
  )
);

-- Daily summaries: therapist can read when relationship is accepted and summary access is enabled.
DROP POLICY IF EXISTS "Therapists can view shared daily summaries" ON public.daily_summaries;
CREATE POLICY "Therapists can view shared daily summaries"
ON public.daily_summaries FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.parent_therapist_relationships ptr
    WHERE ptr.child_id = daily_summaries.child_id
      AND ptr.therapist_id = auth.uid()
      AND ptr.status = 'accepted'
      AND COALESCE(ptr.access_summaries, TRUE) = TRUE
      AND (ptr.access_expires_at IS NULL OR ptr.access_expires_at > NOW())
  )
);

-- Medications: therapist can read when relationship is accepted and medication access is enabled.
DROP POLICY IF EXISTS "Therapists can view shared medications" ON public.medications;
CREATE POLICY "Therapists can view shared medications"
ON public.medications FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.parent_therapist_relationships ptr
    WHERE ptr.child_id = medications.child_id
      AND ptr.therapist_id = auth.uid()
      AND ptr.status = 'accepted'
      AND COALESCE(ptr.access_medications, TRUE) = TRUE
      AND (ptr.access_expires_at IS NULL OR ptr.access_expires_at > NOW())
  )
);
