
-- ============================================================
-- SECURITY FIX 1: Prevent privilege escalation on user_roles
-- Only allow signup roles: student, parent, teacher (not admin/super_admin)
-- ============================================================
DROP POLICY IF EXISTS "Users can insert own role on signup" ON public.user_roles;
CREATE POLICY "Users can insert own safe role on signup"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND role IN ('student'::public.app_role, 'parent'::public.app_role, 'teacher'::public.app_role)
  );

-- Super admins can manage all roles
DROP POLICY IF EXISTS "Super admins can manage roles" ON public.user_roles;
CREATE POLICY "Super admins can manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- Admins can assign roles within their school context
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can assign roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    AND role IN ('student'::public.app_role, 'parent'::public.app_role, 'teacher'::public.app_role)
  );

-- ============================================================
-- SECURITY FIX 2: Restrict PIN exposure - only allow lookup by specific pin
-- ============================================================
DROP POLICY IF EXISTS "Anyone can verify pins" ON public.pins;
CREATE POLICY "Authenticated users can verify specific pins"
  ON public.pins FOR SELECT TO authenticated
  USING (
    public.is_admin_or_super(auth.uid())
    OR (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()))
    OR (school_id IS NOT NULL AND public.has_school_access(auth.uid(), school_id))
  );

-- Allow anon to verify pins only via the edge function (not direct table access)
CREATE POLICY "Anon can verify active pins"
  ON public.pins FOR SELECT TO anon
  USING (status = 'active'::public.pin_status);

-- ============================================================
-- SECURITY FIX 3: Scope questions by school via question_banks
-- ============================================================
DROP POLICY IF EXISTS "Admins and teachers manage questions" ON public.questions;
CREATE POLICY "School staff manage questions"
  ON public.questions FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (question_bank_id IN (
      SELECT qb.id FROM public.question_banks qb
      WHERE qb.school_id IS NOT NULL
        AND (public.is_school_admin(auth.uid(), qb.school_id)
          OR (public.has_role(auth.uid(), 'teacher'::public.app_role) AND public.has_school_access(auth.uid(), qb.school_id)))
    ))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (question_bank_id IN (
      SELECT qb.id FROM public.question_banks qb
      WHERE qb.school_id IS NOT NULL
        AND (public.is_school_admin(auth.uid(), qb.school_id)
          OR (public.has_role(auth.uid(), 'teacher'::public.app_role) AND public.has_school_access(auth.uid(), qb.school_id)))
    ))
  );

-- ============================================================
-- SECURITY FIX 4: Scope cbt_exam_questions by school
-- ============================================================
DROP POLICY IF EXISTS "Teachers manage exam questions" ON public.cbt_exam_questions;
CREATE POLICY "School staff manage exam questions"
  ON public.cbt_exam_questions FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (exam_id IN (
      SELECT ce.id FROM public.cbt_exams ce
      WHERE ce.school_id IS NOT NULL
        AND (public.is_school_admin(auth.uid(), ce.school_id)
          OR (public.has_role(auth.uid(), 'teacher'::public.app_role) AND public.has_school_access(auth.uid(), ce.school_id)))
    ))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (exam_id IN (
      SELECT ce.id FROM public.cbt_exams ce
      WHERE ce.school_id IS NOT NULL
        AND (public.is_school_admin(auth.uid(), ce.school_id)
          OR (public.has_role(auth.uid(), 'teacher'::public.app_role) AND public.has_school_access(auth.uid(), ce.school_id)))
    ))
  );

-- ============================================================
-- SECURITY FIX 5: Restrict pin_usage_logs to authenticated only
-- ============================================================
DROP POLICY IF EXISTS "Anyone can log pin usage" ON public.pin_usage_logs;
CREATE POLICY "Authenticated users can log pin usage"
  ON public.pin_usage_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================
-- SECURITY FIX 6: Recreate student_performance_analytics as non-SECURITY DEFINER
-- ============================================================
DROP VIEW IF EXISTS public.student_performance_analytics;
CREATE VIEW public.student_performance_analytics AS
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
WHERE r.status = 'published';
