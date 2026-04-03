-- Migration: Add INSERT policy for therapist_profiles
-- Run this after 011_update_user_roles_for_therapist.sql

-- Add INSERT policy for therapist_profiles to allow users to create their own profile
CREATE POLICY "Users can insert their own therapist profile"
ON public.therapist_profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);