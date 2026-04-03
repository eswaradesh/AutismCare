-- Migration: Restrict therapist profile insertion to pending status only
-- Run this in Supabase SQL Editor

-- Drop the old overly-permissive insert policy
DROP POLICY IF EXISTS "Users can insert their own therapist profile" ON public.therapist_profiles;

-- Create a secure insert policy where users can ONLY create their profile if status is pending
CREATE POLICY "Users can insert their own pending therapist profile"
ON public.therapist_profiles FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id 
    AND verification_status = 'pending'
);
