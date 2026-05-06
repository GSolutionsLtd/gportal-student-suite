
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_super(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_school_admin(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_school_access(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_school_id(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_school_code(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_claim_school_admin(uuid, uuid) TO authenticated, anon;
