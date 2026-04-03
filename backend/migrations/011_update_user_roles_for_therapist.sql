-- Migration: Update user_roles to support therapist role assignment
-- Run this after 010_create_therapist_profiles.sql

-- Function to auto-assign therapist role when therapist profile is created
CREATE OR REPLACE FUNCTION public.handle_therapist_profile_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Assign therapist role to user
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'therapist')
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_therapist_profile_created_role
    AFTER INSERT ON public.therapist_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_therapist_profile_created();

-- Function to log admin actions
CREATE OR REPLACE FUNCTION public.log_admin_action(
    _action_type TEXT,
    _target_user_id UUID,
    _target_therapist_id UUID DEFAULT NULL,
    _details JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _log_id UUID;
BEGIN
    INSERT INTO public.admin_audit_logs (admin_id, action_type, target_user_id, target_therapist_id, details)
    VALUES (auth.uid(), _action_type, _target_user_id, _target_therapist_id, _details)
    RETURNING id INTO _log_id;
    RETURN _log_id;
END;
$$;
