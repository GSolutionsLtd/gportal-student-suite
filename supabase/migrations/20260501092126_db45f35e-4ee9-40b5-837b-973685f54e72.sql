-- Fix security-definer view so it respects caller permissions
DROP VIEW IF EXISTS public.student_performance_analytics;
CREATE VIEW public.student_performance_analytics
WITH (security_invoker = on) AS
SELECT
  r.student_id,
  s.first_name,
  s.last_name,
  s.admission_number,
  r.term_id,
  t.name AS term_name,
  t.term_type,
  ac.name AS session_name,
  c.name AS class_name,
  c.level AS class_level,
  ca.name AS class_arm_name,
  r.total_score,
  r.average_score,
  r.class_position
FROM public.results r
JOIN public.students s ON r.student_id = s.id
JOIN public.terms t ON r.term_id = t.id
JOIN public.academic_sessions ac ON t.session_id = ac.id
JOIN public.class_arms ca ON r.class_arm_id = ca.id
JOIN public.classes c ON ca.class_id = c.id
WHERE r.status = 'published'::public.result_status;

-- Ensure one login cannot carry multiple dashboard roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'user_roles_one_role_per_user'
  ) THEN
    CREATE UNIQUE INDEX user_roles_one_role_per_user ON public.user_roles(user_id);
  END IF;
END $$;

-- Helper to safely allow an admin signup to claim a new/unassigned school only
CREATE OR REPLACE FUNCTION public.can_claim_school_admin(_user_id uuid, _school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    _user_id IS NOT NULL
    AND _school_id IS NOT NULL
    AND public.has_role(_user_id, 'admin'::public.app_role)
    AND EXISTS (
      SELECT 1
      FROM public.schools s
      WHERE s.id = _school_id
        AND s.subscription_status IN ('trial', 'active')
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.school_admins sa
      WHERE sa.school_id = _school_id
        AND COALESCE(sa.is_primary, true) = true
    )
$$;

-- One primary admin per school
CREATE UNIQUE INDEX IF NOT EXISTS school_admins_one_primary_per_school
ON public.school_admins(school_id)
WHERE COALESCE(is_primary, true) = true;

-- Tighten user role policies while supporting safe school admin signup
DROP POLICY IF EXISTS "Users can insert own safe role on signup" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can assign roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Users can view own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "School admins can view school user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.school_admins sa
    WHERE sa.user_id = user_roles.user_id
      AND public.is_school_admin(auth.uid(), sa.school_id)
  )
  OR EXISTS (
    SELECT 1
    FROM public.teachers t
    WHERE t.user_id = user_roles.user_id
      AND public.is_school_admin(auth.uid(), t.school_id)
  )
  OR EXISTS (
    SELECT 1
    FROM public.students st
    WHERE st.user_id = user_roles.user_id
      AND public.is_school_admin(auth.uid(), st.school_id)
  )
  OR EXISTS (
    SELECT 1
    FROM public.parent_school_memberships psm
    WHERE psm.parent_user_id = user_roles.user_id
      AND public.is_school_admin(auth.uid(), psm.school_id)
  )
);

CREATE POLICY "Users can choose one safe role on signup"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role IN ('admin'::public.app_role, 'teacher'::public.app_role, 'student'::public.app_role, 'parent'::public.app_role)
);

CREATE POLICY "Super admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "School admins can assign non-admin roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  AND role IN ('teacher'::public.app_role, 'student'::public.app_role, 'parent'::public.app_role)
);

-- Tighten school and school admin policies
DROP POLICY IF EXISTS "Super admins can manage school admins" ON public.school_admins;
DROP POLICY IF EXISTS "School users can view school admin assignments" ON public.school_admins;

CREATE POLICY "School users can view school admin assignments"
ON public.school_admins
FOR SELECT
TO authenticated
USING (public.has_school_access(auth.uid(), school_id));

CREATE POLICY "Super admins can manage school admins"
ON public.school_admins
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "New admins can claim unassigned schools"
ON public.school_admins
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND COALESCE(is_primary, true) = true
  AND public.can_claim_school_admin(auth.uid(), school_id)
);

DROP POLICY IF EXISTS "Super admins can manage schools" ON public.schools;
CREATE POLICY "Super admins can manage schools"
ON public.schools
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- Teacher self-onboarding must be authenticated and school-linked
DROP POLICY IF EXISTS "Teachers can insert own record" ON public.teachers;
DROP POLICY IF EXISTS "Teachers can update own record" ON public.teachers;

CREATE POLICY "Teachers can insert own school record"
ON public.teachers
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.has_role(auth.uid(), 'teacher'::public.app_role)
  AND school_id IS NOT NULL
);

CREATE POLICY "Teachers can update own school record"
ON public.teachers
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND school_id IS NOT NULL
);

-- Result teacher policies should not be public
DROP POLICY IF EXISTS "Teachers can insert results for assigned classes" ON public.results;
DROP POLICY IF EXISTS "Teachers can update draft and submitted results" ON public.results;

CREATE POLICY "Teachers can insert results for assigned classes"
ON public.results
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'teacher'::public.app_role)
  AND school_id IS NOT NULL
  AND public.has_school_access(auth.uid(), school_id)
  AND class_arm_id IN (
    SELECT ts.class_arm_id
    FROM public.teacher_subjects ts
    JOIN public.teachers t ON ts.teacher_id = t.id
    WHERE t.user_id = auth.uid()
      AND ts.school_id = results.school_id
  )
);

CREATE POLICY "Teachers can update draft and submitted results"
ON public.results
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'teacher'::public.app_role)
  AND status = ANY (ARRAY['draft'::public.result_status, 'submitted'::public.result_status])
  AND school_id IS NOT NULL
  AND public.has_school_access(auth.uid(), school_id)
  AND class_arm_id IN (
    SELECT ts.class_arm_id
    FROM public.teacher_subjects ts
    JOIN public.teachers t ON ts.teacher_id = t.id
    WHERE t.user_id = auth.uid()
      AND ts.school_id = results.school_id
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'teacher'::public.app_role)
  AND school_id IS NOT NULL
  AND public.has_school_access(auth.uid(), school_id)
);

-- Remove broad direct writes to audit logs; trusted backend functions can still write with service privileges
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Users can create own audit events"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Restrict notifications to signed-in recipients and school admins
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "School admins can create school notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  school_id IS NOT NULL
  AND public.is_school_admin(auth.uid(), school_id)
  AND (
    EXISTS (SELECT 1 FROM public.school_admins sa WHERE sa.user_id = notifications.user_id AND sa.school_id = notifications.school_id)
    OR EXISTS (SELECT 1 FROM public.teachers t WHERE t.user_id = notifications.user_id AND t.school_id = notifications.school_id)
    OR EXISTS (SELECT 1 FROM public.students st WHERE st.user_id = notifications.user_id AND st.school_id = notifications.school_id)
    OR EXISTS (SELECT 1 FROM public.parent_school_memberships psm WHERE psm.parent_user_id = notifications.user_id AND psm.school_id = notifications.school_id)
  )
);

-- Restrict direct PIN usage logging
DROP POLICY IF EXISTS "Authenticated users can log pin usage" ON public.pin_usage_logs;
CREATE POLICY "Authenticated users can log permitted pin usage"
ON public.pin_usage_logs
FOR INSERT
TO authenticated
WITH CHECK (
  student_id IN (SELECT s.id FROM public.students s WHERE s.user_id = auth.uid())
  OR pin_id IN (SELECT p.id FROM public.pins p WHERE p.school_id IS NOT NULL AND public.is_school_admin(auth.uid(), p.school_id))
);

-- Restrict direct function execution. RLS policies can still call these internally.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

GRANT EXECUTE ON FUNCTION public.list_signup_schools() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_school_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_school_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_school_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_super(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_school_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_claim_school_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_result_aggregates(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_class_positions(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_grade_for_score(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_admission_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_pin_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_verification_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_receipt_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_student() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_generate_verification_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_student_pin() TO authenticated;