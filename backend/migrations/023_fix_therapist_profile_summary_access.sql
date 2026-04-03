-- Migration: Ensure therapists can read linked child and parent profiles
-- Run this after therapist relationship migrations

ALTER TABLE public.child_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Therapists can view child profiles they are connected to" ON public.child_profiles;
CREATE POLICY "Therapists can view child profiles they are connected to"
ON public.child_profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.parent_therapist_relationships ptr
    WHERE ptr.child_id = child_profiles.id
      AND ptr.therapist_id = auth.uid()
      AND ptr.status IN ('accepted', 'pending')
      AND (ptr.access_expires_at IS NULL OR ptr.access_expires_at > NOW())
  )
);

DROP POLICY IF EXISTS "Therapists can view parent profiles they are connected to" ON public.profiles;
CREATE POLICY "Therapists can view parent profiles they are connected to"
ON public.profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.parent_therapist_relationships ptr
    WHERE ptr.parent_id = profiles.id
      AND ptr.therapist_id = auth.uid()
      AND ptr.status IN ('accepted', 'pending')
      AND (ptr.access_expires_at IS NULL OR ptr.access_expires_at > NOW())
  )
);
