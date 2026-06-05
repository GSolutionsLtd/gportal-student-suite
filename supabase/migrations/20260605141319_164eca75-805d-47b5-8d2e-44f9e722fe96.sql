
-- Resubmission audit
CREATE OR REPLACE FUNCTION public.audit_assignment_resubmission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.revision_number IS DISTINCT FROM OLD.revision_number
     AND NEW.revision_number > COALESCE(OLD.revision_number, 0) THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (
      auth.uid(),
      'update',
      'assignment_submissions',
      NEW.id,
      jsonb_build_object('revision_number', OLD.revision_number, 'submitted_at', OLD.submitted_at),
      jsonb_build_object(
        'event', 'resubmission',
        'assignment_id', NEW.assignment_id,
        'student_id', NEW.student_id,
        'revision_number', NEW.revision_number,
        'resubmission_count', NEW.resubmission_count,
        'submitted_at', NEW.submitted_at
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_assignment_resubmission ON public.assignment_submissions;
CREATE TRIGGER trg_audit_assignment_resubmission
AFTER UPDATE ON public.assignment_submissions
FOR EACH ROW EXECUTE FUNCTION public.audit_assignment_resubmission();

-- Score release (approval) audit
CREATE OR REPLACE FUNCTION public.audit_assignment_score_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF COALESCE(NEW.score_released, false) IS DISTINCT FROM COALESCE(OLD.score_released, false) THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (
      auth.uid(),
      CASE WHEN NEW.score_released THEN 'approve'::audit_action ELSE 'reject'::audit_action END,
      'assignment_submissions',
      NEW.id,
      jsonb_build_object('score_released', OLD.score_released, 'score', OLD.score),
      jsonb_build_object(
        'event', CASE WHEN NEW.score_released THEN 'score_approved' ELSE 'score_unapproved' END,
        'assignment_id', NEW.assignment_id,
        'student_id', NEW.student_id,
        'score', NEW.score,
        'feedback', NEW.feedback
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_assignment_score_release ON public.assignment_submissions;
CREATE TRIGGER trg_audit_assignment_score_release
AFTER UPDATE ON public.assignment_submissions
FOR EACH ROW EXECUTE FUNCTION public.audit_assignment_score_release();

-- Publish / unpublish audit
CREATE OR REPLACE FUNCTION public.audit_assignment_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  old_status text;
  new_status text;
BEGIN
  old_status := CASE WHEN TG_OP = 'UPDATE' THEN OLD.status::text ELSE NULL END;
  new_status := NEW.status::text;

  IF (TG_OP = 'INSERT' AND new_status = 'published')
     OR (TG_OP = 'UPDATE' AND old_status IS DISTINCT FROM new_status
         AND (new_status = 'published' OR old_status = 'published')) THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (
      auth.uid(),
      CASE WHEN new_status = 'published' THEN 'publish'::audit_action ELSE 'unpublish'::audit_action END,
      'assignments',
      NEW.id,
      jsonb_build_object('status', old_status),
      jsonb_build_object(
        'event', CASE WHEN new_status = 'published' THEN 'assignment_published' ELSE 'assignment_unpublished' END,
        'title', NEW.title,
        'subject_id', NEW.subject_id,
        'class_arm_id', NEW.class_arm_id,
        'due_at', NEW.due_at,
        'status', new_status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_assignment_publish ON public.assignments;
CREATE TRIGGER trg_audit_assignment_publish
AFTER INSERT OR UPDATE OF status ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public.audit_assignment_publish();

-- Rubric score audit
CREATE OR REPLACE FUNCTION public.audit_assignment_rubric_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_data)
    VALUES (
      auth.uid(),
      'create',
      'assignment_rubric_scores',
      NEW.id,
      jsonb_build_object(
        'event', 'rubric_score_created',
        'submission_id', NEW.submission_id,
        'criterion_id', NEW.criterion_id,
        'score', NEW.score,
        'feedback', NEW.feedback
      )
    );
  ELSIF TG_OP = 'UPDATE' AND (
        NEW.score IS DISTINCT FROM OLD.score
     OR NEW.feedback IS DISTINCT FROM OLD.feedback
  ) THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (
      auth.uid(),
      'update',
      'assignment_rubric_scores',
      NEW.id,
      jsonb_build_object('score', OLD.score, 'feedback', OLD.feedback),
      jsonb_build_object(
        'event', 'rubric_score_updated',
        'submission_id', NEW.submission_id,
        'criterion_id', NEW.criterion_id,
        'score', NEW.score,
        'feedback', NEW.feedback
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_assignment_rubric_score ON public.assignment_rubric_scores;
CREATE TRIGGER trg_audit_assignment_rubric_score
AFTER INSERT OR UPDATE ON public.assignment_rubric_scores
FOR EACH ROW EXECUTE FUNCTION public.audit_assignment_rubric_score();
