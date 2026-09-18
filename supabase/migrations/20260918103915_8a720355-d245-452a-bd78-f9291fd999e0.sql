ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS approval_note text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid;

ALTER TABLE public.teachers
  DROP CONSTRAINT IF EXISTS teachers_approval_status_check;
ALTER TABLE public.teachers
  ADD CONSTRAINT teachers_approval_status_check
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

CREATE OR REPLACE FUNCTION public.protect_teacher_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
     AND NOT (
       public.is_school_admin(auth.uid(), OLD.school_id)
       OR public.has_role(auth.uid(), 'super_admin')
       OR auth.uid() IS NULL
     ) THEN
    RAISE EXCEPTION 'Only school administrators can change teacher approval status';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_teacher_approval_trg ON public.teachers;
CREATE TRIGGER protect_teacher_approval_trg
  BEFORE UPDATE ON public.teachers
  FOR EACH ROW EXECUTE FUNCTION public.protect_teacher_approval();

REVOKE EXECUTE ON FUNCTION public.protect_teacher_approval() FROM anon, authenticated;