DROP FUNCTION IF EXISTS public.list_signup_schools();

CREATE OR REPLACE FUNCTION public.list_signup_schools()
RETURNS TABLE(id uuid, code text, name text, admin_available boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    s.id,
    s.code,
    s.name,
    NOT EXISTS (
      SELECT 1 FROM public.school_admins sa
      WHERE sa.school_id = s.id
        AND COALESCE(sa.is_primary, true) = true
    ) AS admin_available
  FROM public.schools s
  WHERE s.subscription_status IN ('trial', 'active')
  ORDER BY s.name ASC
$function$;

GRANT EXECUTE ON FUNCTION public.list_signup_schools() TO anon, authenticated;