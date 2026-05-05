-- Tighten direct EXECUTE access for helper functions that should only run from trusted backend code.
REVOKE ALL ON FUNCTION public.compute_class_positions(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.compute_result_aggregates(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_admission_number() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_pin_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_receipt_number() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_verification_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_grade_for_score(NUMERIC) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.compute_class_positions(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.compute_result_aggregates(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_admission_number() TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_pin_code() TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_receipt_number() TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_verification_code() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_grade_for_score(NUMERIC) TO service_role;

-- Prevent direct self-assignment of School Admin role; Admin onboarding must use the invite completion backend.
DROP POLICY IF EXISTS "Users can choose one safe role on signup" ON public.user_roles;
CREATE POLICY "Users can choose one safe non-admin role on signup"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role = ANY (ARRAY['teacher'::public.app_role, 'student'::public.app_role, 'parent'::public.app_role])
);

-- Public result checking uses the check-result backend function, so active PIN rows should not be listable anonymously.
DROP POLICY IF EXISTS "Anon can verify active pins" ON public.pins;

-- Scope student access to CBT question mappings by the student's own school.
DROP POLICY IF EXISTS "Students read exam questions" ON public.cbt_exam_questions;
CREATE POLICY "Students read own school exam questions"
ON public.cbt_exam_questions
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'student'::public.app_role)
  AND EXISTS (
    SELECT 1
    FROM public.cbt_exams ce
    WHERE ce.id = cbt_exam_questions.exam_id
      AND ce.status = 'published'
      AND ce.school_id IS NOT NULL
      AND public.has_school_access(auth.uid(), ce.school_id)
  )
);

-- Scope student access to question details by their school's question banks.
DROP POLICY IF EXISTS "Students read questions" ON public.questions;
CREATE POLICY "Students read own school questions"
ON public.questions
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'student'::public.app_role)
  AND EXISTS (
    SELECT 1
    FROM public.question_banks qb
    WHERE qb.id = questions.question_bank_id
      AND qb.school_id IS NOT NULL
      AND public.has_school_access(auth.uid(), qb.school_id)
  )
);

-- Replace global class-subject visibility with school-scoped access via the class record.
DROP POLICY IF EXISTS "Authenticated users can view class subjects" ON public.class_subjects;
CREATE POLICY "School users can view class subjects"
ON public.class_subjects
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.classes c
    WHERE c.id = class_subjects.class_id
      AND c.school_id IS NOT NULL
      AND public.has_school_access(auth.uid(), c.school_id)
  )
);

DROP POLICY IF EXISTS "Admins can manage class subjects" ON public.class_subjects;
CREATE POLICY "School admins can manage class subjects"
ON public.class_subjects
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.classes c
    WHERE c.id = class_subjects.class_id
      AND c.school_id IS NOT NULL
      AND public.is_school_admin(auth.uid(), c.school_id)
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.classes c
    WHERE c.id = class_subjects.class_id
      AND c.school_id IS NOT NULL
      AND public.is_school_admin(auth.uid(), c.school_id)
  )
);

-- Replace global score-weight visibility with school-scoped access via the academic session.
DROP POLICY IF EXISTS "Authenticated users can view score weights" ON public.score_weights;
CREATE POLICY "School users can view score weights"
ON public.score_weights
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.academic_sessions s
    WHERE s.id = score_weights.session_id
      AND s.school_id IS NOT NULL
      AND public.has_school_access(auth.uid(), s.school_id)
  )
);

DROP POLICY IF EXISTS "Admins can manage score weights" ON public.score_weights;
CREATE POLICY "School admins can manage score weights"
ON public.score_weights
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.academic_sessions s
    WHERE s.id = score_weights.session_id
      AND s.school_id IS NOT NULL
      AND public.is_school_admin(auth.uid(), s.school_id)
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.academic_sessions s
    WHERE s.id = score_weights.session_id
      AND s.school_id IS NOT NULL
      AND public.is_school_admin(auth.uid(), s.school_id)
  )
);