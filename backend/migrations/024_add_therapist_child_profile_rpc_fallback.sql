-- Migration: Add therapist child profile RPC fallback for strict RLS environments
-- Run this in Supabase SQL Editor if therapist profile summary still shows Unknown.

-- Keep direct policy-based access too.
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

-- RPC fallback: returns child profile + parent name when therapist is linked to child.
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
