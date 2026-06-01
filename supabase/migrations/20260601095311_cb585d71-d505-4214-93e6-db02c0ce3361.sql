-- ============================================================
-- ASSIGNMENT MANAGEMENT MODULE
-- ============================================================

-- Helper: teacher_id resolver (avoids repeating sub-selects in policies)
CREATE OR REPLACE FUNCTION public.get_teacher_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.teachers WHERE user_id = _user_id LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.get_teacher_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_teacher_id(uuid) TO authenticated, service_role;

-- ============================================================
-- 1. assignments
-- ============================================================
CREATE TABLE public.assignments (
  id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id       UUID NOT NULL,
  teacher_id      UUID NOT NULL,
  class_arm_id    UUID NOT NULL,
  subject_id      UUID NOT NULL,
  session_id      UUID,
  term_id         UUID,
  title           TEXT NOT NULL,
  instructions    TEXT,
  attachment_url  TEXT,
  max_score       NUMERIC NOT NULL DEFAULT 100,
  due_at          TIMESTAMP WITH TIME ZONE,
  status          TEXT NOT NULL DEFAULT 'draft',  -- draft | published | closed
  scores_approved BOOLEAN NOT NULL DEFAULT false, -- optional admin approval
  approved_by     UUID,
  approved_at     TIMESTAMP WITH TIME ZONE,
  created_by      UUID NOT NULL,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT assignments_status_check CHECK (status IN ('draft','published','closed'))
);

CREATE INDEX idx_assignments_school    ON public.assignments(school_id);
CREATE INDEX idx_assignments_teacher   ON public.assignments(teacher_id);
CREATE INDEX idx_assignments_class_arm ON public.assignments(class_arm_id);
CREATE INDEX idx_assignments_due_at    ON public.assignments(due_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO authenticated;
GRANT ALL ON public.assignments TO service_role;

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- School admins manage all assignments in their school
CREATE POLICY "School admins manage assignments"
ON public.assignments
FOR ALL
TO authenticated
USING ((school_id IS NOT NULL) AND public.is_school_admin(auth.uid(), school_id))
WITH CHECK ((school_id IS NOT NULL) AND public.is_school_admin(auth.uid(), school_id));

-- Teachers manage their own assignments
CREATE POLICY "Teachers manage own assignments"
ON public.assignments
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'teacher'::public.app_role)
  AND teacher_id = public.get_teacher_id(auth.uid())
  AND public.has_school_access(auth.uid(), school_id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'teacher'::public.app_role)
  AND teacher_id = public.get_teacher_id(auth.uid())
  AND public.has_school_access(auth.uid(), school_id)
);

-- Students can read published assignments for their current class arm
CREATE POLICY "Students read published assignments for own class arm"
ON public.assignments
FOR SELECT
TO authenticated
USING (
  status = 'published'
  AND EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.user_id = auth.uid()
      AND s.current_class_arm_id = assignments.class_arm_id
      AND s.school_id = assignments.school_id
  )
);

-- ============================================================
-- 2. assignment_submissions
-- ============================================================
CREATE TABLE public.assignment_submissions (
  id               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id    UUID NOT NULL,
  student_id       UUID NOT NULL,
  school_id        UUID NOT NULL,
  response_text    TEXT,
  attachment_url   TEXT,
  submitted_at     TIMESTAMP WITH TIME ZONE,
  score            NUMERIC,
  feedback         TEXT,
  graded_by        UUID,
  graded_at        TIMESTAMP WITH TIME ZONE,
  score_released   BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT assignment_submissions_unique UNIQUE (assignment_id, student_id)
);

CREATE INDEX idx_submissions_assignment ON public.assignment_submissions(assignment_id);
CREATE INDEX idx_submissions_student    ON public.assignment_submissions(student_id);
CREATE INDEX idx_submissions_school     ON public.assignment_submissions(school_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_submissions TO authenticated;
GRANT ALL ON public.assignment_submissions TO service_role;

ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

-- School admins: full access in their school
CREATE POLICY "School admins manage assignment submissions"
ON public.assignment_submissions
FOR ALL
TO authenticated
USING ((school_id IS NOT NULL) AND public.is_school_admin(auth.uid(), school_id))
WITH CHECK ((school_id IS NOT NULL) AND public.is_school_admin(auth.uid(), school_id));

-- Teachers: view/update submissions for assignments they own
CREATE POLICY "Teachers view own assignment submissions"
ON public.assignment_submissions
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'teacher'::public.app_role)
  AND EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = assignment_submissions.assignment_id
      AND a.teacher_id = public.get_teacher_id(auth.uid())
  )
);

CREATE POLICY "Teachers grade own assignment submissions"
ON public.assignment_submissions
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'teacher'::public.app_role)
  AND EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = assignment_submissions.assignment_id
      AND a.teacher_id = public.get_teacher_id(auth.uid())
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'teacher'::public.app_role)
  AND EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = assignment_submissions.assignment_id
      AND a.teacher_id = public.get_teacher_id(auth.uid())
  )
);

-- Students: insert/update/view their own submissions
CREATE POLICY "Students view own submissions"
ON public.assignment_submissions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = assignment_submissions.student_id
      AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Students create own submissions"
ON public.assignment_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = assignment_submissions.student_id
      AND s.user_id = auth.uid()
      AND s.school_id = assignment_submissions.school_id
  )
  AND EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = assignment_submissions.assignment_id
      AND a.status = 'published'
  )
);

CREATE POLICY "Students update own ungraded submissions"
ON public.assignment_submissions
FOR UPDATE
TO authenticated
USING (
  graded_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = assignment_submissions.student_id
      AND s.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = assignment_submissions.student_id
      AND s.user_id = auth.uid()
  )
);

-- ============================================================
-- Triggers
-- ============================================================
CREATE TRIGGER update_assignments_updated_at
BEFORE UPDATE ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assignment_submissions_updated_at
BEFORE UPDATE ON public.assignment_submissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();