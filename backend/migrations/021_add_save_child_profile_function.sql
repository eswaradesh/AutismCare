-- Migration 021: Add SECURITY DEFINER function for saving child profiles
-- Run this in Supabase SQL Editor
-- This bypasses RLS for the save operation while still verifying the caller is the owner.

CREATE OR REPLACE FUNCTION public.save_child_profile(
  p_name TEXT,
  p_age_years INTEGER,
  p_age_months INTEGER,
  p_communication_level TEXT,
  p_sensory_preference TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
  v_comm_level communication_level;
  v_sens_pref sensory_preference;
BEGIN
  -- Get the calling user's ID from the auth context
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Cast text to enum types safely
  BEGIN
    v_comm_level := p_communication_level::communication_level;
  EXCEPTION WHEN invalid_text_representation THEN
    v_comm_level := 'developing'::communication_level;
  END;

  BEGIN
    v_sens_pref := p_sensory_preference::sensory_preference;
  EXCEPTION WHEN invalid_text_representation THEN
    v_sens_pref := 'mixed'::sensory_preference;
  END;

  -- Check if profile already exists
  SELECT id INTO v_profile_id
  FROM public.child_profiles
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_profile_id IS NOT NULL THEN
    -- Update existing
    UPDATE public.child_profiles SET
      name = p_name,
      age_years = p_age_years,
      age_months = p_age_months,
      communication_level = v_comm_level,
      sensory_preference = v_sens_pref,
      notes = p_notes,
      updated_at = NOW()
    WHERE id = v_profile_id;
  ELSE
    -- Insert new
    INSERT INTO public.child_profiles (
      user_id, name, age_years, age_months,
      communication_level, sensory_preference, notes
    ) VALUES (
      v_user_id, p_name, p_age_years, p_age_months,
      v_comm_level, v_sens_pref, p_notes
    )
    RETURNING id INTO v_profile_id;
  END IF;

  RETURN v_profile_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.save_child_profile(TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT) TO authenticated;
