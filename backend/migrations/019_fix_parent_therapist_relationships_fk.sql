-- Migration: Fix parent_therapist_relationships foreign key for profiles join
-- Run this in Supabase SQL Editor

-- Drop existing FK if it exists (check name or use cascade)
ALTER TABLE public.parent_therapist_relationships 
DROP CONSTRAINT IF EXISTS parent_therapist_relationships_parent_id_fkey;

-- Re-add FK referencing public.profiles(id)
ALTER TABLE public.parent_therapist_relationships
ADD CONSTRAINT parent_therapist_relationships_parent_id_fkey 
FOREIGN KEY (parent_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
