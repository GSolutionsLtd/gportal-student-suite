
-- 1. school scoping for audit logs
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS school_id uuid;

DROP POLICY IF EXISTS "School admins can view their school audit logs" ON public.audit_logs;
CREATE POLICY "School admins can view their school audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id));

-- 2. assignment lifecycle audit trigger
CREATE OR REPLACE FUNCTION public.audit_assignment_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, school_id, action, table_name, record_id, new_data)
    VALUES (auth.uid(), NEW.school_id, 'create', 'assignments', NEW.id,
      jsonb_build_object('event','assignment_created','title',NEW.title,'status',NEW.status,'due_at',NEW.due_at,'class_arm_id',NEW.class_arm_id,'subject_id',NEW.subject_id));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (user_id, school_id, action, table_name, record_id, old_data, new_data)
    VALUES (auth.uid(), NEW.school_id, 'update', 'assignments', NEW.id,
      jsonb_build_object('title',OLD.title,'status',OLD.status,'due_at',OLD.due_at,'max_score',OLD.max_score,'attachment_url',OLD.attachment_url,'scores_approved',OLD.scores_approved),
      jsonb_build_object('event','assignment_updated','title',NEW.title,'status',NEW.status,'due_at',NEW.due_at,'max_score',NEW.max_score,'attachment_url',NEW.attachment_url,'scores_approved',NEW.scores_approved));
    RETURN NEW;
  ELSE
    INSERT INTO public.audit_logs (user_id, school_id, action, table_name, record_id, old_data)
    VALUES (auth.uid(), OLD.school_id, 'delete', 'assignments', OLD.id,
      jsonb_build_object('event','assignment_deleted','title',OLD.title,'status',OLD.status));
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_assignment_changes ON public.assignments;
CREATE TRIGGER trg_audit_assignment_changes
AFTER INSERT OR UPDATE OR DELETE ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public.audit_assignment_changes();

-- 3. submission created audit
CREATE OR REPLACE FUNCTION public.audit_assignment_submission_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, school_id, action, table_name, record_id, new_data)
  VALUES (auth.uid(), NEW.school_id, 'create', 'assignment_submissions', NEW.id,
    jsonb_build_object('event','submission_created','assignment_id',NEW.assignment_id,'student_id',NEW.student_id,'has_attachment',NEW.attachment_url IS NOT NULL,'submitted_at',NEW.submitted_at));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_assignment_submission_created ON public.assignment_submissions;
CREATE TRIGGER trg_audit_assignment_submission_created
AFTER INSERT ON public.assignment_submissions
FOR EACH ROW EXECUTE FUNCTION public.audit_assignment_submission_created();

-- 4. backfill school_id on existing assignment-related audit rows via triggers going forward only

-- 5. tighten student read access to assignment resource files
DROP POLICY IF EXISTS "assignment_files_student_read_resources" ON storage.objects;
CREATE POLICY "assignment_files_student_read_resources"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'assignment-files'
  AND (storage.foldername(name))[2] = 'assignments'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  AND (storage.foldername(name))[3] ~ '^[0-9a-f-]{36}$'
  AND EXISTS (
    SELECT 1
    FROM public.assignments a
    JOIN public.students s ON s.user_id = auth.uid()
    WHERE a.id = ((storage.foldername(objects.name))[3])::uuid
      AND a.school_id = ((storage.foldername(objects.name))[1])::uuid
      AND a.school_id = s.school_id
      AND a.class_arm_id = s.current_class_arm_id
      AND a.status = 'published'
  )
);
