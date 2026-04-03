-- Auto-verify all existing pending therapist profiles
UPDATE therapist_profiles
SET verification_status = 'verified',
    verified_at = NOW()
WHERE verification_status = 'pending';
