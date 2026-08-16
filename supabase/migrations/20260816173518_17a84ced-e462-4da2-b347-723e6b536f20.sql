REVOKE EXECUTE ON FUNCTION public.snapshot_lesson_plan() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.notify_due_assignments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  inserted_count integer := 0;
  rows_added integer;
  hrs integer;
BEGIN
  FOREACH hrs IN ARRAY ARRAY[48, 24] LOOP
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
        AND a.due_at <= now() + make_interval(hours => hrs)
        AND NOT EXISTS (
          SELECT 1 FROM public.assignment_submissions sub
          WHERE sub.assignment_id = a.id AND sub.student_id = s.id AND sub.submitted_at IS NOT NULL
        )
    ), fresh AS (
      INSERT INTO public.assignment_reminders (assignment_id, user_id, reminder_window)
      SELECT assignment_id, user_id, hrs || 'h-student' FROM targets
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

    GET DIAGNOSTICS rows_added = ROW_COUNT;
    inserted_count := inserted_count + rows_added;
  END LOOP;

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

  GET DIAGNOSTICS rows_added = ROW_COUNT;
  inserted_count := inserted_count + rows_added;

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

  GET DIAGNOSTICS rows_added = ROW_COUNT;
  inserted_count := inserted_count + rows_added;

  UPDATE public.assignments a
  SET due_notification_sent_at = now()
  WHERE a.status = 'published'
    AND a.due_at IS NOT NULL
    AND a.due_at <= now()
    AND a.due_notification_sent_at IS NULL;

  RETURN inserted_count;
END;
$$;