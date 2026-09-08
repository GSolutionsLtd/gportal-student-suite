-- 1. Server-side CBT paper delivery (no answer keys to students)
CREATE OR REPLACE FUNCTION public.get_cbt_exam_paper(_exam_id uuid)
RETURNS TABLE(id uuid, question_text text, question_type text, option_a text, option_b text, option_c text, option_d text, marks integer, sort_order integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.id, q.question_text, q.question_type, q.option_a, q.option_b, q.option_c, q.option_d, q.marks, eq.sort_order
  FROM public.cbt_exam_questions eq
  JOIN public.questions q ON q.id = eq.question_id
  JOIN public.cbt_exams e ON e.id = eq.exam_id
  JOIN public.students s ON s.user_id = auth.uid()
  WHERE eq.exam_id = _exam_id
    AND e.status = 'published'
    AND e.school_id = s.school_id
    AND e.class_arm_id = s.current_class_arm_id
  ORDER BY eq.sort_order;
$$;

-- 2. Server-side attempt creation with max-attempt enforcement
CREATE OR REPLACE FUNCTION public.start_cbt_attempt(_exam_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student public.students%ROWTYPE;
  v_exam public.cbt_exams%ROWTYPE;
  v_count integer;
  v_attempt_id uuid;
BEGIN
  SELECT * INTO v_student FROM public.students WHERE user_id = auth.uid() LIMIT 1;
  IF v_student.id IS NULL THEN RAISE EXCEPTION 'Student record not found'; END IF;

  SELECT * INTO v_exam FROM public.cbt_exams WHERE id = _exam_id;
  IF v_exam.id IS NULL OR v_exam.status <> 'published'
     OR v_exam.school_id IS DISTINCT FROM v_student.school_id
     OR v_exam.class_arm_id IS DISTINCT FROM v_student.current_class_arm_id THEN
    RAISE EXCEPTION 'Exam not available';
  END IF;

  SELECT count(*) INTO v_count FROM public.cbt_attempts WHERE exam_id = _exam_id AND student_id = v_student.id;
  IF v_count >= COALESCE(v_exam.max_attempts, 1) THEN
    RAISE EXCEPTION 'Maximum attempts reached';
  END IF;

  INSERT INTO public.cbt_attempts (exam_id, student_id, school_id, total_marks, status)
  VALUES (_exam_id, v_student.id, v_exam.school_id, v_exam.total_marks, 'in_progress')
  RETURNING id INTO v_attempt_id;

  RETURN v_attempt_id;
END;
$$;

-- 3. Server-side grading
CREATE OR REPLACE FUNCTION public.submit_cbt_attempt(_attempt_id uuid, _answers jsonb, _time_spent_seconds integer DEFAULT NULL)
RETURNS TABLE(score integer, total_marks integer, percentage numeric, passed boolean, show_result boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid;
  v_attempt public.cbt_attempts%ROWTYPE;
  v_exam public.cbt_exams%ROWTYPE;
  v_score integer := 0;
  v_total integer := 0;
  v_pct numeric := 0;
BEGIN
  SELECT id INTO v_student_id FROM public.students WHERE user_id = auth.uid() LIMIT 1;
  IF v_student_id IS NULL THEN RAISE EXCEPTION 'Student record not found'; END IF;

  SELECT * INTO v_attempt FROM public.cbt_attempts WHERE id = _attempt_id AND student_id = v_student_id;
  IF v_attempt.id IS NULL THEN RAISE EXCEPTION 'Attempt not found'; END IF;
  IF v_attempt.status = 'completed' THEN RAISE EXCEPTION 'Attempt already submitted'; END IF;

  SELECT * INTO v_exam FROM public.cbt_exams WHERE id = v_attempt.exam_id;

  DELETE FROM public.cbt_answers WHERE attempt_id = _attempt_id;

  INSERT INTO public.cbt_answers (attempt_id, question_id, selected_answer, is_correct, marks_awarded)
  SELECT _attempt_id,
         q.id,
         NULLIF(_answers ->> q.id::text, ''),
         (upper(COALESCE(_answers ->> q.id::text, '')) = upper(COALESCE(q.correct_answer, '~'))),
         CASE WHEN upper(COALESCE(_answers ->> q.id::text, '')) = upper(COALESCE(q.correct_answer, '~'))
              THEN COALESCE(q.marks, 1) ELSE 0 END
  FROM public.cbt_exam_questions eq
  JOIN public.questions q ON q.id = eq.question_id
  WHERE eq.exam_id = v_attempt.exam_id;

  SELECT COALESCE(sum(a.marks_awarded), 0) INTO v_score FROM public.cbt_answers a WHERE a.attempt_id = _attempt_id;
  SELECT COALESCE(sum(COALESCE(q.marks, 1)), 0) INTO v_total
  FROM public.cbt_exam_questions eq JOIN public.questions q ON q.id = eq.question_id
  WHERE eq.exam_id = v_attempt.exam_id;

  v_pct := CASE WHEN v_total > 0 THEN round((v_score::numeric / v_total) * 100, 2) ELSE 0 END;

  UPDATE public.cbt_attempts
  SET score = v_score,
      total_marks = v_total,
      percentage = v_pct,
      status = 'completed',
      submitted_at = now(),
      time_spent_seconds = GREATEST(COALESCE(_time_spent_seconds, 0), 0)
  WHERE id = _attempt_id;

  RETURN QUERY SELECT v_score, v_total, v_pct,
    v_pct >= COALESCE(v_exam.pass_mark, 40)::numeric,
    COALESCE(v_exam.show_result_immediately, false);
END;
$$;

REVOKE ALL ON FUNCTION public.get_cbt_exam_paper(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.start_cbt_attempt(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_cbt_attempt(uuid, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_cbt_exam_paper(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_cbt_attempt(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_cbt_attempt(uuid, jsonb, integer) TO authenticated;

-- 4. Remove direct student access to answer keys and to writing their own scores
DROP POLICY IF EXISTS "Students read own school questions" ON public.questions;
DROP POLICY IF EXISTS "Students manage own answers" ON public.cbt_answers;
DROP POLICY IF EXISTS "Students manage own attempts" ON public.cbt_attempts;

CREATE POLICY "Students view own attempts"
ON public.cbt_attempts FOR SELECT TO authenticated
USING (student_id IN (SELECT s.id FROM public.students s WHERE s.user_id = auth.uid()));

CREATE POLICY "Students view own answers"
ON public.cbt_answers FOR SELECT TO authenticated
USING (attempt_id IN (
  SELECT a.id FROM public.cbt_attempts a
  JOIN public.students s ON s.id = a.student_id
  WHERE s.user_id = auth.uid()
));

-- 5. Parent messages must stay inside the child's school
CREATE OR REPLACE FUNCTION public.validate_parent_teacher_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_school uuid;
  v_teacher_school uuid;
BEGIN
  SELECT s.school_id INTO v_student_school
  FROM public.students s
  JOIN public.parent_students ps ON ps.student_id = s.id
  WHERE s.id = NEW.student_id
    AND ps.parent_user_id = NEW.parent_user_id
    AND ps.is_active = true
  LIMIT 1;

  IF v_student_school IS NULL THEN
    RAISE EXCEPTION 'You are not linked to this student';
  END IF;

  SELECT t.school_id INTO v_teacher_school FROM public.teachers t WHERE t.id = NEW.teacher_id;
  IF v_teacher_school IS NULL OR v_teacher_school <> v_student_school THEN
    RAISE EXCEPTION 'Selected staff member does not belong to your child''s school';
  END IF;

  NEW.school_id := v_student_school;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_parent_teacher_message() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS validate_parent_teacher_message_trg ON public.parent_teacher_messages;
CREATE TRIGGER validate_parent_teacher_message_trg
BEFORE INSERT ON public.parent_teacher_messages
FOR EACH ROW EXECUTE FUNCTION public.validate_parent_teacher_message();

-- 6. Explicit, ownership-scoped DELETE policy for student submission files
DROP POLICY IF EXISTS "assignment_files_student_delete_own" ON storage.objects;
CREATE POLICY "assignment_files_student_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'assignment-files'
  AND (storage.foldername(name))[2] = 'submissions'
  AND (storage.foldername(name))[4] = auth.uid()::text
);

-- 7. Lock down SECURITY DEFINER functions exposed to anon / all users
REVOKE ALL ON FUNCTION public.enforce_careeraid_counseling_access() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_careeraid_free_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_rating_counselor() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_active_careeraid_subscription(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_career_counselors() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_careeraid_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_career_counselors() TO authenticated;