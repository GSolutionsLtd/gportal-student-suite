-- Ensure a school can only have one primary Admin assignment.
CREATE UNIQUE INDEX IF NOT EXISTS school_admins_one_primary_per_school_idx
ON public.school_admins (school_id)
WHERE COALESCE(is_primary, true) = true;

-- The invite code generator is backend-only; frontend now calls an authenticated backend function.
REVOKE ALL ON FUNCTION public.generate_admin_invite_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_admin_invite_code() TO service_role;

-- Public signup school listing and invite validation move to backend functions, not directly callable RPCs.
REVOKE ALL ON FUNCTION public.list_signup_schools() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_signup_schools() TO service_role;

REVOKE ALL ON FUNCTION public.validate_admin_invite(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_admin_invite(TEXT) TO service_role;

-- Stop public object listing for the public school-assets bucket.
DROP POLICY IF EXISTS "School assets are publicly accessible" ON storage.objects;