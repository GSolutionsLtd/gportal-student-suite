-- 1. Lesson plan version history
CREATE TABLE public.lesson_plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_plan_id uuid NOT NULL REFERENCES public.lesson_plans(id) ON DELETE CASCADE,
  school_id uuid NOT NULL,
  version_number integer NOT NULL,
  changed_by uuid,
  change_kind text NOT NULL DEFAULT 'update',
  title text,
  topic text,
  grade_level text,
  duration_minutes integer,
  objectives text,
  materials text,
  introduction text,
  main_content text,
  activities text,
  evaluation text,
  homework text,
  references_notes text,
  subject_id uuid,
  class_arm_id uuid,
  status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lpv_plan ON public.lesson_plan_versions(lesson_plan_id, version_number DESC);

GRANT SELECT ON public.lesson_plan_versions TO authenticated;
GRANT ALL ON public.lesson_plan_versions TO service_role;

ALTER TABLE public.lesson_plan_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and school admins can view lesson plan versions"
ON public.lesson_plan_versions FOR SELECT TO authenticated
USING (
  public.is_school_admin(auth.uid(), school_id)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.lesson_plans lp
    WHERE lp.id = lesson_plan_versions.lesson_plan_id
      AND lp.teacher_user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.snapshot_lesson_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_version integer;
  kind text := 'update';
BEGIN
  IF TG_OP = 'INSERT' THEN
    kind := 'create';
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    kind := CASE WHEN NEW.status = 'published' THEN 'publish' ELSE 'unpublish' END;
  ELSIF OLD.title IS NOT DISTINCT FROM NEW.title
    AND OLD.topic IS NOT DISTINCT FROM NEW.topic
    AND OLD.objectives IS NOT DISTINCT FROM NEW.objectives
    AND OLD.materials IS NOT DISTINCT FROM NEW.materials
    AND OLD.introduction IS NOT DISTINCT FROM NEW.introduction
    AND OLD.main_content IS NOT DISTINCT FROM NEW.main_content
    AND OLD.activities IS NOT DISTINCT FROM NEW.activities
    AND OLD.evaluation IS NOT DISTINCT FROM NEW.evaluation
    AND OLD.homework IS NOT DISTINCT FROM NEW.homework
    AND OLD.references_notes IS NOT DISTINCT FROM NEW.references_notes
    AND OLD.grade_level IS NOT DISTINCT FROM NEW.grade_level
    AND OLD.duration_minutes IS NOT DISTINCT FROM NEW.duration_minutes
    AND OLD.subject_id IS NOT DISTINCT FROM NEW.subject_id
    AND OLD.class_arm_id IS NOT DISTINCT FROM NEW.class_arm_id
  THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_version
  FROM public.lesson_plan_versions WHERE lesson_plan_id = NEW.id;

  INSERT INTO public.lesson_plan_versions (
    lesson_plan_id, school_id, version_number, changed_by, change_kind,
    title, topic, grade_level, duration_minutes, objectives, materials,
    introduction, main_content, activities, evaluation, homework,
    references_notes, subject_id, class_arm_id, status
  ) VALUES (
    NEW.id, NEW.school_id, next_version, auth.uid(), kind,
    NEW.title, NEW.topic, NEW.grade_level, NEW.duration_minutes, NEW.objectives, NEW.materials,
    NEW.introduction, NEW.main_content, NEW.activities, NEW.evaluation, NEW.homework,
    NEW.references_notes, NEW.subject_id, NEW.class_arm_id, NEW.status
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_snapshot_lesson_plan
AFTER INSERT OR UPDATE ON public.lesson_plans
FOR EACH ROW EXECUTE FUNCTION public.snapshot_lesson_plan();

-- 2. Assignment due reminders (dedupe ledger)
CREATE TABLE public.assignment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reminder_window text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, user_id, reminder_window)
);

GRANT SELECT ON public.assignment_reminders TO authenticated;
GRANT ALL ON public.assignment_reminders TO service_role;

ALTER TABLE public.assignment_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own assignment reminders"
ON public.assignment_reminders FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION private.notify_due_assignments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  inserted_count integer := 0;
  n integer;
BEGIN
  -- Student reminders: 48h and 24h before due, only when not yet submitted
  FOR n IN SELECT unnest(ARRAY[48, 24]) LOOP
    WITH targets AS (
      SELECT a.id AS assignment_id, a.school_id, a.title, a.due_at, s.user_id
      FROM public.assignments a
      JOIN public.students s
        ON s.current_class_arm_id = a.class_arm_id
       AND s.school_id = a.school_id
       AND s.is_active = true
       AND s.user_id IS NOT NULL
      WHERE a.status = 'published'
        AND a.due_at IS NOT NULL
        AND a.due_at > now()
        AND a.due_at <= now() + make_interval(hours => n)
        AND NOT EXISTS (
          SELECT 1 FROM public.assignment_submissions sub
          WHERE sub.assignment_id = a.id AND sub.student_id = s.id AND sub.submitted_at IS NOT NULL
        )
    ), fresh AS (
      INSERT INTO public.assignment_reminders (assignment_id, user_id, reminder_window)
      SELECT assignment_id, user_id, n || 'h-student' FROM targets
      ON CONFLICT DO NOTHING
      RETURNING assignment_id, user_id
    )
    INSERT INTO public.notifications (user_id, school_id, title, message, type, link)
    SELECT t.user_id, t.school_id,
           'Assignment due soon',
           t.title || ' is due ' || to_char(t.due_at, 'Mon DD, YYYY HH12:MI AM') || '. You have not submitted yet.',
           'assignment', '/student/assignments'
    FROM fresh f JOIN targets t
      ON t.assignment_id = f.assignment_id AND t.user_id = f.user_id;

    GET DIAGNOSTICS n = ROW_COUNT;
    inserted_count := inserted_count + n;
    n := CASE WHEN inserted_count >= 0 THEN n END;
  END LOOP;

  -- Teacher reminders: 24h before due when work is still ungraded / unapproved
  WITH targets AS (
    SELECT DISTINCT a.id AS assignment_id, a.school_id, a.title, a.due_at, t.user_id
    FROM public.assignments a
    JOIN public.teachers t ON t.id = a.teacher_id AND t.user_id IS NOT NULL
    WHERE a.status = 'published'
      AND a.due_at IS NOT NULL
      AND a.due_at > now()
      AND a.due_at <= now() + interval '24 hours'
      AND (
        a.scores_approved = false
        OR EXISTS (
          SELECT 1 FROM public.assignment_submissions sub
          WHERE sub.assignment_id = a.id AND sub.score IS NULL
        )
      )
  ), fresh AS (
    INSERT INTO public.assignment_reminders (assignment_id, user_id, reminder_window)
    SELECT assignment_id, user_id, '24h-teacher' FROM targets
    ON CONFLICT DO NOTHING
    RETURNING assignment_id, user_id
  )
  INSERT INTO public.notifications (user_id, school_id, title, message, type, link)
  SELECT t.user_id, t.school_id,
         'Assignment closing soon',
         t.title || ' closes ' || to_char(t.due_at, 'Mon DD, YYYY HH12:MI AM') || '. Review and approve submissions before the window closes.',
         'assignment', '/teacher/assignments'
  FROM fresh f JOIN targets t
    ON t.assignment_id = f.assignment_id AND t.user_id = f.user_id;

  GET DIAGNOSTICS n = ROW_COUNT;
  inserted_count := inserted_count + n;

  -- Due-now notice to teachers (existing behaviour)
  WITH due AS (
    SELECT a.id, a.school_id, a.title, t.user_id
    FROM public.assignments a
    JOIN public.teachers t ON t.id = a.teacher_id AND t.user_id IS NOT NULL
    WHERE a.status = 'published'
      AND a.due_at IS NOT NULL
      AND a.due_at <= now()
      AND a.due_notification_sent_at IS NULL
  )
  INSERT INTO public.notifications (user_id, school_id, title, message, type, link)
  SELECT user_id, school_id, 'Assignment due now', title || ' has reached its due date.', 'assignment', '/teacher/assignments'
  FROM due;

  GET DIAGNOSTICS n = ROW_COUNT;
  inserted_count := inserted_count + n;

  UPDATE public.assignments a
  SET due_notification_sent_at = now()
  WHERE a.status = 'published'
    AND a.due_at IS NOT NULL
    AND a.due_at <= now()
    AND a.due_notification_sent_at IS NULL;

  RETURN inserted_count;
END;
$$;