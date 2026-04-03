-- Migration: Relax therapist read restrictions across patient data tables
-- NOTE: This is intentionally permissive for therapist READ access.
-- It keeps existing write restrictions unchanged.

-- Helper function: identify whether current authenticated user is a therapist.
CREATE OR REPLACE FUNCTION public.is_therapist_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.therapist_profiles tp
    WHERE tp.user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_therapist_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_therapist_user(UUID) TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_therapist_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.behavior_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated therapist to read parent profiles.
DROP POLICY IF EXISTS "Therapists can read all parent profiles" ON public.profiles;
CREATE POLICY "Therapists can read all parent profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.is_therapist_user(auth.uid()));

-- Allow any authenticated therapist to read all child profiles.
DROP POLICY IF EXISTS "Therapists can read all child profiles" ON public.child_profiles;
CREATE POLICY "Therapists can read all child profiles"
ON public.child_profiles FOR SELECT
TO authenticated
USING (public.is_therapist_user(auth.uid()));

-- Allow any authenticated therapist to read all therapist-parent relationships.
DROP POLICY IF EXISTS "Therapists can read all relationships" ON public.parent_therapist_relationships;
CREATE POLICY "Therapists can read all relationships"
ON public.parent_therapist_relationships FOR SELECT
TO authenticated
USING (public.is_therapist_user(auth.uid()));

-- Allow any authenticated therapist to read all routine entries.
DROP POLICY IF EXISTS "Therapists can read all routine entries" ON public.routine_entries;
CREATE POLICY "Therapists can read all routine entries"
ON public.routine_entries FOR SELECT
TO authenticated
USING (public.is_therapist_user(auth.uid()));

-- Allow any authenticated therapist to read all behavior entries.
DROP POLICY IF EXISTS "Therapists can read all behavior entries" ON public.behavior_entries;
CREATE POLICY "Therapists can read all behavior entries"
ON public.behavior_entries FOR SELECT
TO authenticated
USING (public.is_therapist_user(auth.uid()));

-- Allow any authenticated therapist to read all daily summaries.
DROP POLICY IF EXISTS "Therapists can read all daily summaries" ON public.daily_summaries;
CREATE POLICY "Therapists can read all daily summaries"
ON public.daily_summaries FOR SELECT
TO authenticated
USING (public.is_therapist_user(auth.uid()));

-- Allow any authenticated therapist to read all medications.
DROP POLICY IF EXISTS "Therapists can read all medications" ON public.medications;
CREATE POLICY "Therapists can read all medications"
ON public.medications FOR SELECT
TO authenticated
USING (public.is_therapist_user(auth.uid()));
