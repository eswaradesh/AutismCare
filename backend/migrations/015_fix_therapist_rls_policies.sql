-- Migration: Update RLS policies to allow therapists to view pending and accepted invites
-- Run this in Supabase SQL Editor

-- 1. Allow therapists to view child profiles for pending/accepted relationships
CREATE POLICY "Therapists can view child profiles they are connected to"
ON public.child_profiles
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.parent_therapist_relationships ptr
        WHERE ptr.child_id = id
        AND ptr.therapist_id = auth.uid()
        AND ptr.status IN ('pending', 'accepted')
    )
);

-- 2. Allow therapists to view parent profiles for pending/accepted relationships
CREATE POLICY "Therapists can view parent profiles they are connected to"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.parent_therapist_relationships ptr
        WHERE ptr.parent_id = id
        AND ptr.therapist_id = auth.uid()
        AND ptr.status IN ('pending', 'accepted')
    )
);

-- 3. Also make sure therapists can view their OWN profile regardless of verification status to prevent UI bugs
DROP POLICY IF EXISTS "Therapists can view own profile" ON public.therapist_profiles;
CREATE POLICY "Therapists can view own profile"
ON public.therapist_profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
