-- Migration: Create therapist profiles and verification system
-- Run this in Supabase SQL Editor

-- Create therapist verification status enum
CREATE TYPE public.therapist_verification_status AS ENUM ('pending', 'verified', 'rejected', 'suspended');

-- Create therapist_profiles table
CREATE TABLE public.therapist_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    qualification TEXT NOT NULL,
    specialization TEXT,
    registration_number TEXT NOT NULL,
    clinic_name TEXT,
    contact_email TEXT,
    degree_certificate_url TEXT,
    license_document_url TEXT,
    verification_status therapist_verification_status NOT NULL DEFAULT 'pending',
    verified_by UUID REFERENCES auth.users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create parent_therapist_relationships table for consent and access control
CREATE TABLE public.parent_therapist_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    therapist_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    child_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'revoked'
    access_routines BOOLEAN DEFAULT true,
    access_behaviors BOOLEAN DEFAULT true,
    access_summaries BOOLEAN DEFAULT true,
    access_reports BOOLEAN DEFAULT true,
    access_medications BOOLEAN DEFAULT true, -- read-only
    access_expires_at TIMESTAMP WITH TIME ZONE,
    invited_by UUID REFERENCES auth.users(id), -- parent who invited
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_by UUID REFERENCES auth.users(id),
    UNIQUE (parent_id, therapist_id, child_id)
);

-- Create therapist_notes table (observational only)
CREATE TABLE public.therapist_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    therapist_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    child_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE NOT NULL,
    parent_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    note_text TEXT NOT NULL,
    note_type TEXT DEFAULT 'observational', -- 'observational', 'planning'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create admin_audit_logs table for tracking admin actions
CREATE TABLE public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL, -- 'verify_therapist', 'reject_therapist', 'suspend_therapist', 'revoke_access'
    target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    target_therapist_id UUID REFERENCES public.therapist_profiles(id) ON DELETE SET NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create behavior_alerts table for parent-shared alerts
CREATE TABLE public.behavior_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    child_id UUID REFERENCES public.child_profiles(id) ON DELETE CASCADE NOT NULL,
    behavior_entry_id UUID REFERENCES public.behavior_entries(id) ON DELETE CASCADE,
    shared_with_therapist_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    alert_type TEXT DEFAULT 'sudden_change',
    reviewed_by_therapist BOOLEAN DEFAULT false,
    therapist_review_status TEXT, -- 'reviewed', 'needs_followup'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.therapist_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_therapist_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.behavior_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for therapist_profiles
CREATE POLICY "Therapists can view own profile"
ON public.therapist_profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Therapists can update own profile before verification"
ON public.therapist_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND verification_status = 'pending');

CREATE POLICY "Admins can view all therapist profiles"
ON public.therapist_profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update therapist verification"
ON public.therapist_profiles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Verified therapists are visible to parents"
ON public.therapist_profiles FOR SELECT
TO authenticated
USING (verification_status = 'verified');

-- RLS Policies for parent_therapist_relationships
CREATE POLICY "Parents can manage their relationships"
ON public.parent_therapist_relationships FOR ALL
TO authenticated
USING (auth.uid() = parent_id);

CREATE POLICY "Therapists can view relationships they're part of"
ON public.parent_therapist_relationships FOR SELECT
TO authenticated
USING (auth.uid() = therapist_id);

-- RLS Policies for therapist_notes
CREATE POLICY "Therapists can manage their own notes"
ON public.therapist_notes FOR ALL
TO authenticated
USING (auth.uid() = therapist_id);

CREATE POLICY "Parents can view notes about their children"
ON public.therapist_notes FOR SELECT
TO authenticated
USING (auth.uid() = parent_id);

-- RLS Policies for admin_audit_logs
CREATE POLICY "Admins can view all audit logs"
ON public.admin_audit_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for behavior_alerts
CREATE POLICY "Parents can manage their alerts"
ON public.behavior_alerts FOR ALL
TO authenticated
USING (auth.uid() = parent_id);

CREATE POLICY "Therapists can view alerts shared with them"
ON public.behavior_alerts FOR SELECT
TO authenticated
USING (auth.uid() = shared_with_therapist_id);

-- Update app_role enum to include 'therapist'
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'therapist';

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_therapist_profiles_updated_at
    BEFORE UPDATE ON public.therapist_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_therapist_notes_updated_at
    BEFORE UPDATE ON public.therapist_notes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
