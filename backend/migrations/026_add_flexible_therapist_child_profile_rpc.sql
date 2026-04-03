-- Migration: Flexible therapist child-profile RPC fallback
-- Handles both child_id and relationship_id references, including relationships with NULL child_id.

CREATE OR REPLACE FUNCTION public.get_therapist_child_profile_flexible(p_ref_id UUID)
RETURNS TABLE (
  relationship_id UUID,
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
DECLARE
  v_relationship_id UUID;
  v_parent_id UUID;
  v_child_id UUID;
BEGIN
  -- Resolve a relationship either by direct relationship id or by child id.
  SELECT ptr.id, ptr.parent_id, ptr.child_id
  INTO v_relationship_id, v_parent_id, v_child_id
  FROM public.parent_therapist_relationships ptr
  WHERE ptr.therapist_id = auth.uid()
    AND ptr.status IN ('accepted', 'pending')
    AND (ptr.access_expires_at IS NULL OR ptr.access_expires_at > NOW())
    AND (ptr.id = p_ref_id OR ptr.child_id = p_ref_id)
  ORDER BY ptr.accepted_at DESC NULLS LAST, ptr.invited_at DESC NULLS LAST
  LIMIT 1;

  IF v_relationship_id IS NULL THEN
    RETURN;
  END IF;

  -- If relationship has no child_id yet, fallback to latest child profile of that parent.
  IF v_child_id IS NULL THEN
    SELECT cp.id
    INTO v_child_id
    FROM public.child_profiles cp
    WHERE cp.user_id = v_parent_id
    ORDER BY cp.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_child_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    v_relationship_id,
    cp.id,
    cp.name,
    COALESCE(cp.age_years, 0) AS age_years,
    COALESCE(cp.age_months, 0) AS age_months,
    COALESCE(cp.communication_level::text, 'unknown') AS communication_level,
    COALESCE(cp.sensory_preference::text, 'unknown') AS sensory_preference,
    v_parent_id,
    COALESCE(p.full_name, 'Parent') AS parent_name
  FROM public.child_profiles cp
  LEFT JOIN public.profiles p ON p.id = v_parent_id
  WHERE cp.id = v_child_id
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_therapist_child_profile_flexible(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_therapist_child_profile_flexible(UUID) TO authenticated;
