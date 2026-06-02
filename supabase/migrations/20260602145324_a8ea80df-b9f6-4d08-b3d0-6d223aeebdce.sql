CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$ SELECT private.has_role(_user_id, _role) $$;

CREATE OR REPLACE FUNCTION private.get_user_role(_user_id uuid)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$ SELECT private.get_user_role(_user_id) $$;

CREATE OR REPLACE FUNCTION private.get_teacher_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.teachers WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_teacher_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$ SELECT private.get_teacher_id(_user_id) $$;

CREATE OR REPLACE FUNCTION private.is_admin_or_super(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'super_admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_super(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$ SELECT private.is_admin_or_super(_user_id) $$;

CREATE OR REPLACE FUNCTION private.can_claim_school_admin(_user_id uuid, _school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT _user_id IS NOT NULL
    AND _school_id IS NOT NULL
    AND private.has_role(_user_id, 'admin'::public.app_role)
    AND EXISTS (
      SELECT 1 FROM public.schools s
      WHERE s.id = _school_id AND s.subscription_status IN ('trial', 'active')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.school_admins sa
      WHERE sa.school_id = _school_id AND COALESCE(sa.is_primary, true) = true
    )
$$;

CREATE OR REPLACE FUNCTION public.can_claim_school_admin(_user_id uuid, _school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$ SELECT private.can_claim_school_admin(_user_id, _school_id) $$;

CREATE OR REPLACE FUNCTION private.is_school_admin(_user_id uuid, _school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_admins sa
    WHERE sa.user_id = _user_id AND sa.school_id = _school_id
  ) OR private.has_role(_user_id, 'super_admin'::public.app_role)
$$;

CREATE OR REPLACE FUNCTION public.is_school_admin(_user_id uuid, _school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$ SELECT private.is_school_admin(_user_id, _school_id) $$;

CREATE OR REPLACE FUNCTION private.has_school_access(_user_id uuid, _school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT CASE
    WHEN _school_id IS NULL THEN false
    WHEN private.has_role(_user_id, 'super_admin'::public.app_role) THEN true
    ELSE EXISTS (
      SELECT 1 FROM (
        SELECT sa.school_id FROM public.school_admins sa WHERE sa.user_id = _user_id
        UNION ALL SELECT t.school_id FROM public.teachers t WHERE t.user_id = _user_id
        UNION ALL SELECT s.school_id FROM public.students s WHERE s.user_id = _user_id
        UNION ALL SELECT psm.school_id FROM public.parent_school_memberships psm WHERE psm.parent_user_id = _user_id
      ) memberships WHERE memberships.school_id = _school_id
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.has_school_access(_user_id uuid, _school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$ SELECT private.has_school_access(_user_id, _school_id) $$;

CREATE OR REPLACE FUNCTION private.get_user_school_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM (
    SELECT sa.school_id, 1 AS priority FROM public.school_admins sa WHERE sa.user_id = _user_id AND COALESCE(sa.is_primary, true)
    UNION ALL SELECT t.school_id, 2 AS priority FROM public.teachers t WHERE t.user_id = _user_id
    UNION ALL SELECT s.school_id, 3 AS priority FROM public.students s WHERE s.user_id = _user_id
    UNION ALL SELECT psm.school_id, 4 AS priority FROM public.parent_school_memberships psm WHERE psm.parent_user_id = _user_id AND psm.is_primary = true
  ) school_sources
  WHERE school_id IS NOT NULL
  ORDER BY priority
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_user_school_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$ SELECT private.get_user_school_id(_user_id) $$;

CREATE OR REPLACE FUNCTION private.get_user_school_code(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT s.code FROM public.schools s WHERE s.id = private.get_user_school_id(_user_id) LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_user_school_code(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$ SELECT private.get_user_school_code(_user_id) $$;

CREATE OR REPLACE FUNCTION private.validate_admin_invite(_code text)
RETURNS TABLE(school_id uuid, school_code text, school_name text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.code, s.name, ai.email
  FROM public.admin_invites ai
  JOIN public.schools s ON s.id = ai.school_id
  WHERE ai.code = upper(trim(_code))
    AND ai.used_at IS NULL
    AND ai.expires_at > now()
    AND s.subscription_status IN ('trial','active')
    AND NOT EXISTS (
      SELECT 1 FROM public.school_admins sa
      WHERE sa.school_id = ai.school_id AND COALESCE(sa.is_primary, true) = true
    )
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.validate_admin_invite(_code text)
RETURNS TABLE(school_id uuid, school_code text, school_name text, email text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$ SELECT * FROM private.validate_admin_invite(_code) $$;

CREATE OR REPLACE FUNCTION private.list_signup_schools()
RETURNS TABLE(id uuid, code text, name text, admin_available boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.code, s.name,
    NOT EXISTS (
      SELECT 1 FROM public.school_admins sa
      WHERE sa.school_id = s.id AND COALESCE(sa.is_primary, true) = true
    ) AS admin_available
  FROM public.schools s
  WHERE s.subscription_status IN ('trial', 'active')
  ORDER BY s.name ASC
$$;

CREATE OR REPLACE FUNCTION public.list_signup_schools()
RETURNS TABLE(id uuid, code text, name text, admin_available boolean)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$ SELECT * FROM private.list_signup_schools() $$;

CREATE OR REPLACE FUNCTION private.notify_due_assignments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE inserted_count integer := 0;
BEGIN
  WITH due AS (
    SELECT a.id, a.school_id, a.teacher_id, a.title, a.due_at, t.user_id
    FROM public.assignments a
    JOIN public.teachers t ON t.id = a.teacher_id
    WHERE a.status = 'published'
      AND a.due_at IS NOT NULL
      AND a.due_at <= now()
      AND a.due_notification_sent_at IS NULL
      AND t.user_id IS NOT NULL
  ), inserted AS (
    INSERT INTO public.notifications (user_id, school_id, title, message, type, link)
    SELECT user_id, school_id, 'Assignment due now', title || ' has reached its due date.', 'assignment', '/teacher/assignments'
    FROM due
    RETURNING 1
  )
  SELECT count(*) INTO inserted_count FROM inserted;

  UPDATE public.assignments a
  SET due_notification_sent_at = now()
  WHERE a.status = 'published'
    AND a.due_at IS NOT NULL
    AND a.due_at <= now()
    AND a.due_notification_sent_at IS NULL;

  RETURN inserted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_due_assignments()
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, private
AS $$ SELECT private.notify_due_assignments() $$;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_school_access(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_school_admin(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_or_super(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_claim_school_admin(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_teacher_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_school_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_school_code(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_admin_invite(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_signup_schools() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notify_due_assignments() TO authenticated, service_role;