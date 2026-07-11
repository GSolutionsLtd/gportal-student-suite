
-- Allow students to see lesson plans that teachers publish to their class
CREATE POLICY "Students view published lesson plans"
  ON public.lesson_plans FOR SELECT TO authenticated
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.user_id = auth.uid()
        AND s.school_id = lesson_plans.school_id
        AND (
          lesson_plans.class_arm_id IS NULL
          OR s.current_class_arm_id = lesson_plans.class_arm_id
        )
    )
  );
