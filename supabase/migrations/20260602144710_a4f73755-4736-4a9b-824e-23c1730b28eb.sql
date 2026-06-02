-- Ensure new enhancement flags exist for every school and for future schools
ALTER TABLE public.schools
  ALTER COLUMN enabled_features
  SET DEFAULT '{"results": true, "cbt": true, "finance": true, "assignments": false, "lesson_notes": false, "careeraid": false}'::jsonb;

UPDATE public.schools
SET enabled_features = COALESCE(enabled_features, '{}'::jsonb)
  || jsonb_build_object(
    'results', COALESCE(enabled_features->'results', to_jsonb(true)),
    'cbt', COALESCE(enabled_features->'cbt', to_jsonb(true)),
    'finance', COALESCE(enabled_features->'finance', to_jsonb(true)),
    'assignments', COALESCE(enabled_features->'assignments', to_jsonb(false)),
    'lesson_notes', COALESCE(enabled_features->'lesson_notes', to_jsonb(false)),
    'careeraid', COALESCE(enabled_features->'careeraid', to_jsonb(false))
  );

-- Assignment workflow extensions
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS allow_resubmissions boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS published_notified_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS due_notification_sent_at timestamp with time zone;

ALTER TABLE public.assignment_submissions
  ADD COLUMN IF NOT EXISTS revision_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS resubmission_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.assignment_submission_revisions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id uuid NOT NULL,
  assignment_id uuid NOT NULL,
  student_id uuid NOT NULL,
  school_id uuid NOT NULL,
  revision_number integer NOT NULL,
  response_text text,
  attachment_url text,
  submitted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_submission_revisions TO authenticated;
GRANT ALL ON public.assignment_submission_revisions TO service_role;

ALTER TABLE public.assignment_submission_revisions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.assignment_rubric_criteria (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id uuid NOT NULL,
  school_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  weight numeric NOT NULL DEFAULT 0,
  max_score numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT assignment_rubric_weight_check CHECK (weight >= 0 AND weight <= 100),
  CONSTRAINT assignment_rubric_max_score_check CHECK (max_score >= 0)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_rubric_criteria TO authenticated;
GRANT ALL ON public.assignment_rubric_criteria TO service_role;

ALTER TABLE public.assignment_rubric_criteria ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.assignment_rubric_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id uuid NOT NULL,
  assignment_id uuid NOT NULL,
  criterion_id uuid NOT NULL,
  student_id uuid NOT NULL,
  school_id uuid NOT NULL,
  score numeric NOT NULL DEFAULT 0,
  feedback text,
  graded_by uuid,
  graded_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT assignment_rubric_scores_unique UNIQUE (submission_id, criterion_id),
  CONSTRAINT assignment_rubric_score_check CHECK (score >= 0)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_rubric_scores TO authenticated;
GRANT ALL ON public.assignment_rubric_scores TO service_role;

ALTER TABLE public.assignment_rubric_scores ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_assignment_revisions_submission ON public.assignment_submission_revisions(submission_id);
CREATE INDEX IF NOT EXISTS idx_assignment_revisions_assignment ON public.assignment_submission_revisions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_revisions_student ON public.assignment_submission_revisions(student_id);
CREATE INDEX IF NOT EXISTS idx_assignment_rubric_assignment ON public.assignment_rubric_criteria(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_rubric_scores_submission ON public.assignment_rubric_scores(submission_id);
CREATE INDEX IF NOT EXISTS idx_assignment_rubric_scores_assignment ON public.assignment_rubric_scores(assignment_id);

-- RLS policies for revision history
DROP POLICY IF EXISTS "School admins manage assignment revisions" ON public.assignment_submission_revisions;
CREATE POLICY "School admins manage assignment revisions"
ON public.assignment_submission_revisions
FOR ALL
TO authenticated
USING ((school_id IS NOT NULL) AND public.is_school_admin(auth.uid(), school_id))
WITH CHECK ((school_id IS NOT NULL) AND public.is_school_admin(auth.uid(), school_id));

DROP POLICY IF EXISTS "Teachers view assignment revisions" ON public.assignment_submission_revisions;
CREATE POLICY "Teachers view assignment revisions"
ON public.assignment_submission_revisions
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'teacher'::public.app_role)
  AND EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = assignment_submission_revisions.assignment_id
      AND a.teacher_id = public.get_teacher_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Students view own assignment revisions" ON public.assignment_submission_revisions;
CREATE POLICY "Students view own assignment revisions"
ON public.assignment_submission_revisions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = assignment_submission_revisions.student_id
      AND s.user_id = auth.uid()
  )
);

-- RLS policies for rubric criteria
DROP POLICY IF EXISTS "School admins manage assignment rubrics" ON public.assignment_rubric_criteria;
CREATE POLICY "School admins manage assignment rubrics"
ON public.assignment_rubric_criteria
FOR ALL
TO authenticated
USING ((school_id IS NOT NULL) AND public.is_school_admin(auth.uid(), school_id))
WITH CHECK ((school_id IS NOT NULL) AND public.is_school_admin(auth.uid(), school_id));

DROP POLICY IF EXISTS "Teachers manage own assignment rubrics" ON public.assignment_rubric_criteria;
CREATE POLICY "Teachers manage own assignment rubrics"
ON public.assignment_rubric_criteria
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'teacher'::public.app_role)
  AND EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = assignment_rubric_criteria.assignment_id
      AND a.teacher_id = public.get_teacher_id(auth.uid())
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'teacher'::public.app_role)
  AND EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = assignment_rubric_criteria.assignment_id
      AND a.teacher_id = public.get_teacher_id(auth.uid())
      AND a.school_id = assignment_rubric_criteria.school_id
  )
);

DROP POLICY IF EXISTS "Students view published assignment rubrics" ON public.assignment_rubric_criteria;
CREATE POLICY "Students view published assignment rubrics"
ON public.assignment_rubric_criteria
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.assignments a
    JOIN public.students s ON s.user_id = auth.uid()
    WHERE a.id = assignment_rubric_criteria.assignment_id
      AND a.status = 'published'
      AND s.current_class_arm_id = a.class_arm_id
      AND s.school_id = a.school_id
  )
);

-- RLS policies for rubric scores
DROP POLICY IF EXISTS "School admins manage assignment rubric scores" ON public.assignment_rubric_scores;
CREATE POLICY "School admins manage assignment rubric scores"
ON public.assignment_rubric_scores
FOR ALL
TO authenticated
USING ((school_id IS NOT NULL) AND public.is_school_admin(auth.uid(), school_id))
WITH CHECK ((school_id IS NOT NULL) AND public.is_school_admin(auth.uid(), school_id));

DROP POLICY IF EXISTS "Teachers manage own assignment rubric scores" ON public.assignment_rubric_scores;
CREATE POLICY "Teachers manage own assignment rubric scores"
ON public.assignment_rubric_scores
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'teacher'::public.app_role)
  AND EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = assignment_rubric_scores.assignment_id
      AND a.teacher_id = public.get_teacher_id(auth.uid())
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'teacher'::public.app_role)
  AND EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = assignment_rubric_scores.assignment_id
      AND a.teacher_id = public.get_teacher_id(auth.uid())
      AND a.school_id = assignment_rubric_scores.school_id
  )
);

DROP POLICY IF EXISTS "Students view released rubric scores" ON public.assignment_rubric_scores;
CREATE POLICY "Students view released rubric scores"
ON public.assignment_rubric_scores
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.assignment_submissions sub
    JOIN public.students s ON s.id = sub.student_id
    WHERE sub.id = assignment_rubric_scores.submission_id
      AND s.user_id = auth.uid()
      AND sub.score_released = true
  )
);

-- Tighten student submission policies for resubmission-before-due-date
DROP POLICY IF EXISTS "Students create own submissions" ON public.assignment_submissions;
CREATE POLICY "Students create own submissions"
ON public.assignment_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.assignments a ON a.id = assignment_submissions.assignment_id
    WHERE s.id = assignment_submissions.student_id
      AND s.user_id = auth.uid()
      AND s.school_id = assignment_submissions.school_id
      AND a.school_id = assignment_submissions.school_id
      AND a.class_arm_id = s.current_class_arm_id
      AND a.status = 'published'
      AND (a.due_at IS NULL OR a.due_at > now())
  )
);

DROP POLICY IF EXISTS "Students update own ungraded submissions" ON public.assignment_submissions;
CREATE POLICY "Students resubmit own submissions before due date"
ON public.assignment_submissions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.assignments a ON a.id = assignment_submissions.assignment_id
    WHERE s.id = assignment_submissions.student_id
      AND s.user_id = auth.uid()
      AND a.status = 'published'
      AND a.allow_resubmissions = true
      AND (a.due_at IS NULL OR a.due_at > now())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.assignments a ON a.id = assignment_submissions.assignment_id
    WHERE s.id = assignment_submissions.student_id
      AND s.user_id = auth.uid()
      AND a.status = 'published'
      AND a.allow_resubmissions = true
      AND (a.due_at IS NULL OR a.due_at > now())
  )
);

DROP POLICY IF EXISTS "Teachers create own assignment submissions" ON public.assignment_submissions;
CREATE POLICY "Teachers create own assignment submissions"
ON public.assignment_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'teacher'::public.app_role)
  AND EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = assignment_submissions.assignment_id
      AND a.teacher_id = public.get_teacher_id(auth.uid())
      AND a.school_id = assignment_submissions.school_id
  )
);

-- Triggers and helper functions
CREATE OR REPLACE FUNCTION public.handle_assignment_submission_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF public.has_role(auth.uid(), 'student'::public.app_role) THEN
      NEW.submitted_at := COALESCE(NEW.submitted_at, now());
      NEW.score := NULL;
      NEW.feedback := NULL;
      NEW.graded_by := NULL;
      NEW.graded_at := NULL;
      NEW.score_released := false;
      NEW.revision_number := 1;
      NEW.resubmission_count := 0;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND public.has_role(auth.uid(), 'student'::public.app_role) THEN
    IF (OLD.response_text IS DISTINCT FROM NEW.response_text)
       OR (OLD.attachment_url IS DISTINCT FROM NEW.attachment_url) THEN
      INSERT INTO public.assignment_submission_revisions (
        submission_id, assignment_id, student_id, school_id,
        revision_number, response_text, attachment_url, submitted_at
      ) VALUES (
        OLD.id, OLD.assignment_id, OLD.student_id, OLD.school_id,
        OLD.revision_number, OLD.response_text, OLD.attachment_url, OLD.submitted_at
      );

      NEW.submitted_at := now();
      NEW.revision_number := OLD.revision_number + 1;
      NEW.resubmission_count := OLD.resubmission_count + 1;
      NEW.score := NULL;
      NEW.feedback := NULL;
      NEW.graded_by := NULL;
      NEW.graded_at := NULL;
      NEW.score_released := false;
    ELSE
      NEW.score := OLD.score;
      NEW.feedback := OLD.feedback;
      NEW.graded_by := OLD.graded_by;
      NEW.graded_at := OLD.graded_at;
      NEW.score_released := OLD.score_released;
      NEW.revision_number := OLD.revision_number;
      NEW.resubmission_count := OLD.resubmission_count;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_assignment_submission_revision() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_assignment_submission_revision() TO service_role;

DROP TRIGGER IF EXISTS assignment_submission_revision_trigger ON public.assignment_submissions;
CREATE TRIGGER assignment_submission_revision_trigger
BEFORE INSERT OR UPDATE ON public.assignment_submissions
FOR EACH ROW
EXECUTE FUNCTION public.handle_assignment_submission_revision();

CREATE TRIGGER update_assignment_rubric_criteria_updated_at
BEFORE UPDATE ON public.assignment_rubric_criteria
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assignment_rubric_scores_updated_at
BEFORE UPDATE ON public.assignment_rubric_scores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.notify_assignment_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  subject_name text;
BEGIN
  IF NEW.status = 'published'
     AND NEW.published_notified_at IS NULL
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
    SELECT name INTO subject_name FROM public.subjects WHERE id = NEW.subject_id LIMIT 1;

    INSERT INTO public.notifications (user_id, school_id, title, message, type, link)
    SELECT s.user_id,
           NEW.school_id,
           'New assignment published',
           NEW.title || COALESCE(' • ' || subject_name, '') || CASE WHEN NEW.due_at IS NULL THEN '' ELSE ' is due ' || to_char(NEW.due_at, 'Mon DD, YYYY HH12:MI AM') END,
           'assignment',
           '/student/assignments'
    FROM public.students s
    WHERE s.school_id = NEW.school_id
      AND s.current_class_arm_id = NEW.class_arm_id
      AND s.is_active = true
      AND s.user_id IS NOT NULL;

    UPDATE public.assignments
    SET published_notified_at = now()
    WHERE id = NEW.id
      AND published_notified_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_assignment_published() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_assignment_published() TO service_role;

DROP TRIGGER IF EXISTS assignment_publish_notification_trigger ON public.assignments;
CREATE TRIGGER assignment_publish_notification_trigger
AFTER INSERT OR UPDATE OF status ON public.assignments
FOR EACH ROW
EXECUTE FUNCTION public.notify_assignment_published();

CREATE OR REPLACE FUNCTION public.notify_due_assignments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer := 0;
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
    SELECT user_id,
           school_id,
           'Assignment due now',
           title || ' has reached its due date.',
           'assignment',
           '/teacher/assignments'
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

REVOKE EXECUTE ON FUNCTION public.notify_due_assignments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_due_assignments() TO authenticated, service_role;

-- Keep SECURITY DEFINER helper access explicit for linter cleanliness
REVOKE EXECUTE ON FUNCTION public.get_teacher_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_teacher_id(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.validate_admin_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_admin_invite(text) TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.list_signup_schools() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_signup_schools() TO anon, authenticated, service_role;