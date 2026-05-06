
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_super(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_school_admin(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_school_access(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_school_id(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_school_code(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_claim_school_admin(uuid, uuid) FROM anon;
