-- Diagnostics: verify therapist-linked child profile values
-- Run in Supabase SQL Editor

-- 1) Replace this with the therapist auth user id you are testing
-- Example: '00000000-0000-0000-0000-000000000000'
WITH therapist AS (
  SELECT 'REPLACE_THERAPIST_USER_ID'::uuid AS therapist_id
), linked AS (
  SELECT
    ptr.id AS relationship_id,
    ptr.status,
    ptr.parent_id,
    ptr.therapist_id,
    ptr.child_id,
    ptr.access_expires_at,
    cp.name AS child_name,
    cp.age_years,
    cp.age_months,
    cp.communication_level::text AS communication_level,
    cp.sensory_preference::text AS sensory_preference,
    p.full_name AS parent_name
  FROM public.parent_therapist_relationships ptr
  LEFT JOIN public.child_profiles cp ON cp.id = ptr.child_id
  LEFT JOIN public.profiles p ON p.id = ptr.parent_id
  JOIN therapist t ON t.therapist_id = ptr.therapist_id
)
SELECT *
FROM linked
ORDER BY status, child_name;

-- 2) Show only rows where profile summary fields are missing/unknown
WITH therapist AS (
  SELECT 'REPLACE_THERAPIST_USER_ID'::uuid AS therapist_id
)
SELECT
  ptr.id AS relationship_id,
  ptr.status,
  ptr.child_id,
  cp.name AS child_name,
  cp.age_years,
  cp.age_months,
  cp.communication_level::text AS communication_level,
  cp.sensory_preference::text AS sensory_preference
FROM public.parent_therapist_relationships ptr
LEFT JOIN public.child_profiles cp ON cp.id = ptr.child_id
JOIN therapist t ON t.therapist_id = ptr.therapist_id
WHERE
  cp.id IS NULL
  OR cp.communication_level IS NULL
  OR cp.sensory_preference IS NULL
  OR COALESCE(cp.age_years, 0) = 0
ORDER BY ptr.status, cp.name;

-- 3) Optional: check if RPC fallback returns data for a specific child
-- Replace child UUID before running
SELECT *
FROM public.get_therapist_child_profile('REPLACE_CHILD_ID'::uuid);
