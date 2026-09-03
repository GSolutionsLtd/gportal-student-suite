
REVOKE EXECUTE ON FUNCTION public.admin_list_counselor_profiles() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_review_counselor(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_counselor_sessions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_counselor_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_counselor(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_counselor_sessions(uuid) TO authenticated;
