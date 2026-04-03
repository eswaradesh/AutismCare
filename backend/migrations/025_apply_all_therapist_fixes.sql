-- Migration: Consolidated therapist fixes (idempotent)
-- Purpose:
-- 1) Therapist can read linked child/parent profile data (fixes Unknown profile summary)
-- 2) Therapist can read shared routine/behavior/summary/medication data
-- 3) Therapist can delete own activity suggestions
-- 4) RPC fallback for strict RLS environments
-- 5) Normalize therapist_activity_suggestions schema (title + status)

-- -----------------------------------------------------------------------------
-- 0) Ensure key columns exist in therapist_activity_suggestions
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'therapist_activity_suggestions'
      AND column_name = 'title'
  ) THEN
    ALTER TABLE public.therapist_activity_suggestions
    ADD COLUMN title TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'therapist_activity_suggestions'
      AND column_name = 'activity_title'
  ) THEN
    EXECUTE '
      UPDATE public.therapist_activity_suggestions
      SET title = activity_title
      WHERE title IS NULL
    ';
  END IF;
END $$;

ALTER TABLE public.therapist_activity_suggestions
ALTER COLUMN title SET DEFAULT NULL;

ALTER TABLE public.therapist_activity_suggestions
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- -----------------------------------------------------------------------------
-- 1) Ensure RLS enabled
-- -----------------------------------------------------------------------------
ALTER TABLE public.child_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.behavior_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_activity_suggestions ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 2) Therapist profile summary access (child + parent profile rows)
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 3) Therapist shared-data read access
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 4) Therapist delete own suggestions
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Therapists can delete their suggestions" ON public.therapist_activity_suggestions;
CREATE POLICY "Therapists can delete their suggestions"
ON public.therapist_activity_suggestions FOR DELETE
TO authenticated
USING (auth.uid() = therapist_id);

-- -----------------------------------------------------------------------------
-- 5) RPC fallback for strict RLS environments
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_therapist_child_profile(p_child_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  age_years INTEGER,
  age_months INTEGER,
  communication_level TEXT,
  sensory_preference TEXT,
  parent_id UUID,
  parent_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.parent_therapist_relationships ptr
    WHERE ptr.child_id = p_child_id
      AND ptr.therapist_id = auth.uid()
      AND ptr.status IN ('accepted', 'pending')
      AND (ptr.access_expires_at IS NULL OR ptr.access_expires_at > NOW())
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    cp.id,
    cp.name,
    COALESCE(cp.age_years, 0) AS age_years,
    COALESCE(cp.age_months, 0) AS age_months,
    COALESCE(cp.communication_level::text, 'unknown') AS communication_level,
    COALESCE(cp.sensory_preference::text, 'unknown') AS sensory_preference,
    ptr.parent_id,
    COALESCE(p.full_name, 'Parent') AS parent_name
  FROM public.child_profiles cp
  JOIN public.parent_therapist_relationships ptr ON ptr.child_id = cp.id
  LEFT JOIN public.profiles p ON p.id = ptr.parent_id
  WHERE cp.id = p_child_id
    AND ptr.therapist_id = auth.uid()
    AND ptr.status IN ('accepted', 'pending')
    AND (ptr.access_expires_at IS NULL OR ptr.access_expires_at > NOW())
  ORDER BY ptr.accepted_at DESC NULLS LAST, ptr.invited_at DESC NULLS LAST
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_therapist_child_profile(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_therapist_child_profile(UUID) TO authenticated;
