ALTER TABLE public.school_settings ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
ALTER TABLE public.academic_sessions ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
ALTER TABLE public.terms ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
ALTER TABLE public.grading_scales ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
ALTER TABLE public.class_arms ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
ALTER TABLE public.teacher_subjects ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
ALTER TABLE public.question_banks ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
ALTER TABLE public.cbt_exams ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
ALTER TABLE public.cbt_attempts ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
ALTER TABLE public.result_components ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
ALTER TABLE public.fee_structures ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
ALTER TABLE public.fee_payments ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
ALTER TABLE public.pins ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
ALTER TABLE public.parent_students ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
ALTER TABLE public.parent_teacher_messages ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
ALTER TABLE public.notification_preferences ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);

CREATE TABLE IF NOT EXISTS public.parent_school_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id uuid NOT NULL,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  linked_by uuid NULL,
  is_primary boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(parent_user_id, school_id)
);

ALTER TABLE public.parent_school_memberships ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_school_settings_school_id_unique
  ON public.school_settings(school_id)
  WHERE school_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_school_admins_primary_school_unique
  ON public.school_admins(school_id)
  WHERE is_primary = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_parent_school_memberships_primary_parent_unique
  ON public.parent_school_memberships(parent_user_id)
  WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_academic_sessions_school_id ON public.academic_sessions(school_id);
CREATE INDEX IF NOT EXISTS idx_terms_school_id ON public.terms(school_id);
CREATE INDEX IF NOT EXISTS idx_grading_scales_school_id ON public.grading_scales(school_id);
CREATE INDEX IF NOT EXISTS idx_class_arms_school_id ON public.class_arms(school_id);
CREATE INDEX IF NOT EXISTS idx_teacher_subjects_school_id ON public.teacher_subjects(school_id);
CREATE INDEX IF NOT EXISTS idx_question_banks_school_id ON public.question_banks(school_id);
CREATE INDEX IF NOT EXISTS idx_cbt_exams_school_id ON public.cbt_exams(school_id);
CREATE INDEX IF NOT EXISTS idx_cbt_attempts_school_id ON public.cbt_attempts(school_id);
CREATE INDEX IF NOT EXISTS idx_results_school_id ON public.results(school_id);
CREATE INDEX IF NOT EXISTS idx_result_components_school_id ON public.result_components(school_id);
CREATE INDEX IF NOT EXISTS idx_fee_structures_school_id ON public.fee_structures(school_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_school_id ON public.fee_payments(school_id);
CREATE INDEX IF NOT EXISTS idx_pins_school_id ON public.pins(school_id);
CREATE INDEX IF NOT EXISTS idx_parent_students_school_id ON public.parent_students(school_id);
CREATE INDEX IF NOT EXISTS idx_parent_teacher_messages_school_id ON public.parent_teacher_messages(school_id);
CREATE INDEX IF NOT EXISTS idx_notifications_school_id ON public.notifications(school_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_school_id ON public.notification_preferences(school_id);
CREATE INDEX IF NOT EXISTS idx_parent_school_memberships_school_id ON public.parent_school_memberships(school_id);
CREATE INDEX IF NOT EXISTS idx_parent_school_memberships_parent_user_id ON public.parent_school_memberships(parent_user_id);

UPDATE public.school_settings ss
SET school_id = s.id
FROM public.schools s
WHERE ss.school_id IS NULL
  AND lower(trim(ss.school_name)) = lower(trim(s.name));

UPDATE public.academic_sessions acs
SET school_id = sa.school_id
FROM public.school_admins sa
WHERE acs.school_id IS NULL
  AND acs.created_by = sa.user_id;

UPDATE public.terms t
SET school_id = acs.school_id
FROM public.academic_sessions acs
WHERE t.school_id IS NULL
  AND t.session_id = acs.id;

UPDATE public.class_arms ca
SET school_id = c.school_id
FROM public.classes c
WHERE ca.school_id IS NULL
  AND ca.class_id = c.id;

UPDATE public.teacher_subjects ts
SET school_id = t.school_id
FROM public.teachers t
WHERE ts.school_id IS NULL
  AND ts.teacher_id = t.id;

UPDATE public.question_banks qb
SET school_id = c.school_id
FROM public.classes c
WHERE qb.school_id IS NULL
  AND qb.class_id = c.id;

UPDATE public.cbt_exams ce
SET school_id = ca.school_id
FROM public.class_arms ca
WHERE ce.school_id IS NULL
  AND ce.class_arm_id = ca.id;

UPDATE public.cbt_attempts caa
SET school_id = s.school_id
FROM public.students s
WHERE caa.school_id IS NULL
  AND caa.student_id = s.id;

UPDATE public.results r
SET school_id = COALESCE(
  (SELECT s.school_id FROM public.students s WHERE s.id = r.student_id),
  (SELECT ca.school_id FROM public.class_arms ca WHERE ca.id = r.class_arm_id)
)
WHERE r.school_id IS NULL;

UPDATE public.result_components rc
SET school_id = r.school_id
FROM public.results r
WHERE rc.school_id IS NULL
  AND rc.result_id = r.id;

UPDATE public.fee_structures fs
SET school_id = COALESCE(
  (SELECT c.school_id FROM public.classes c WHERE c.id = fs.class_id),
  (SELECT sa.school_id FROM public.school_admins sa WHERE sa.user_id = fs.created_by ORDER BY sa.is_primary DESC, sa.created_at ASC LIMIT 1)
)
WHERE fs.school_id IS NULL;

UPDATE public.fee_payments fp
SET school_id = s.school_id
FROM public.students s
WHERE fp.school_id IS NULL
  AND fp.student_id = s.id;

UPDATE public.pins p
SET school_id = s.school_id
FROM public.students s
WHERE p.school_id IS NULL
  AND p.student_id = s.id;

UPDATE public.parent_students ps
SET school_id = s.school_id
FROM public.students s
WHERE ps.school_id IS NULL
  AND ps.student_id = s.id;

UPDATE public.parent_teacher_messages ptm
SET school_id = COALESCE(
  (SELECT ps.school_id FROM public.parent_students ps WHERE ps.student_id = ptm.student_id AND ps.parent_user_id = ptm.parent_user_id ORDER BY ps.linked_at DESC LIMIT 1),
  (SELECT s.school_id FROM public.students s WHERE s.id = ptm.student_id)
)
WHERE ptm.school_id IS NULL;

INSERT INTO public.parent_school_memberships (parent_user_id, school_id, linked_by, is_primary)
SELECT DISTINCT ps.parent_user_id, ps.school_id, ps.linked_by, true
FROM public.parent_students ps
WHERE ps.school_id IS NOT NULL
ON CONFLICT (parent_user_id, school_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_user_school_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id
  FROM (
    SELECT sa.school_id, 1 AS priority
    FROM public.school_admins sa
    WHERE sa.user_id = _user_id
      AND COALESCE(sa.is_primary, true)

    UNION ALL

    SELECT t.school_id, 2 AS priority
    FROM public.teachers t
    WHERE t.user_id = _user_id

    UNION ALL

    SELECT s.school_id, 3 AS priority
    FROM public.students s
    WHERE s.user_id = _user_id

    UNION ALL

    SELECT psm.school_id, 4 AS priority
    FROM public.parent_school_memberships psm
    WHERE psm.parent_user_id = _user_id
      AND psm.is_primary = true
  ) school_sources
  WHERE school_id IS NOT NULL
  ORDER BY priority
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_user_school_code(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.code
  FROM public.schools s
  WHERE s.id = public.get_user_school_id(_user_id)
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_school_admin(_user_id uuid, _school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_admins sa
    WHERE sa.user_id = _user_id
      AND sa.school_id = _school_id
  )
  OR public.has_role(_user_id, 'super_admin'::public.app_role)
$$;

CREATE OR REPLACE FUNCTION public.has_school_access(_user_id uuid, _school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _school_id IS NULL THEN false
    WHEN public.has_role(_user_id, 'super_admin'::public.app_role) THEN true
    ELSE EXISTS (
      SELECT 1
      FROM (
        SELECT sa.school_id
        FROM public.school_admins sa
        WHERE sa.user_id = _user_id

        UNION ALL

        SELECT t.school_id
        FROM public.teachers t
        WHERE t.user_id = _user_id

        UNION ALL

        SELECT s.school_id
        FROM public.students s
        WHERE s.user_id = _user_id

        UNION ALL

        SELECT psm.school_id
        FROM public.parent_school_memberships psm
        WHERE psm.parent_user_id = _user_id
      ) memberships
      WHERE memberships.school_id = _school_id
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.list_signup_schools()
RETURNS TABLE (id uuid, code text, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.code, s.name
  FROM public.schools s
  WHERE s.subscription_status IN ('trial', 'active')
  ORDER BY s.name ASC
$$;

UPDATE public.notifications n
SET school_id = public.get_user_school_id(n.user_id)
WHERE n.school_id IS NULL
  AND public.get_user_school_id(n.user_id) IS NOT NULL;

UPDATE public.notification_preferences np
SET school_id = public.get_user_school_id(np.user_id)
WHERE np.school_id IS NULL
  AND public.get_user_school_id(np.user_id) IS NOT NULL;

DROP POLICY IF EXISTS "Admins can view their school" ON public.schools;
CREATE POLICY "Users can view their own school"
ON public.schools
FOR SELECT
TO authenticated
USING (public.has_school_access(auth.uid(), id));

DROP POLICY IF EXISTS "School admins can view their school admins" ON public.school_admins;
CREATE POLICY "School users can view school admin assignments"
ON public.school_admins
FOR SELECT
TO authenticated
USING (public.has_school_access(auth.uid(), school_id));

DROP POLICY IF EXISTS "Anyone can view school settings" ON public.school_settings;
DROP POLICY IF EXISTS "Admins can manage school settings" ON public.school_settings;
CREATE POLICY "School users can view school settings"
ON public.school_settings
FOR SELECT
TO authenticated
USING (school_id IS NOT NULL AND public.has_school_access(auth.uid(), school_id));
CREATE POLICY "School admins can manage school settings"
ON public.school_settings
FOR ALL
TO authenticated
USING (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id))
WITH CHECK (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id));

DROP POLICY IF EXISTS "Admins can manage sessions" ON public.academic_sessions;
DROP POLICY IF EXISTS "Authenticated users can view sessions" ON public.academic_sessions;
CREATE POLICY "School users can view sessions"
ON public.academic_sessions
FOR SELECT
TO authenticated
USING (school_id IS NOT NULL AND public.has_school_access(auth.uid(), school_id));
CREATE POLICY "School admins can manage sessions"
ON public.academic_sessions
FOR ALL
TO authenticated
USING (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id))
WITH CHECK (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id));

DROP POLICY IF EXISTS "Admins can manage terms" ON public.terms;
DROP POLICY IF EXISTS "Authenticated users can view terms" ON public.terms;
CREATE POLICY "School users can view terms"
ON public.terms
FOR SELECT
TO authenticated
USING (school_id IS NOT NULL AND public.has_school_access(auth.uid(), school_id));
CREATE POLICY "School admins can manage terms"
ON public.terms
FOR ALL
TO authenticated
USING (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id))
WITH CHECK (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id));

DROP POLICY IF EXISTS "Admins can manage grading scales" ON public.grading_scales;
DROP POLICY IF EXISTS "Authenticated users can view grading scales" ON public.grading_scales;
CREATE POLICY "School users can view grading scales"
ON public.grading_scales
FOR SELECT
TO authenticated
USING (school_id IS NOT NULL AND public.has_school_access(auth.uid(), school_id));
CREATE POLICY "School admins can manage grading scales"
ON public.grading_scales
FOR ALL
TO authenticated
USING (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id))
WITH CHECK (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id));

DROP POLICY IF EXISTS "Admins can manage classes" ON public.classes;
DROP POLICY IF EXISTS "Authenticated users can view classes" ON public.classes;
CREATE POLICY "School users can view classes"
ON public.classes
FOR SELECT
TO authenticated
USING (school_id IS NOT NULL AND public.has_school_access(auth.uid(), school_id));
CREATE POLICY "School admins can manage classes"
ON public.classes
FOR ALL
TO authenticated
USING (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id))
WITH CHECK (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id));

DROP POLICY IF EXISTS "Admins can manage class arms" ON public.class_arms;
DROP POLICY IF EXISTS "Authenticated users can view class arms" ON public.class_arms;
CREATE POLICY "School users can view class arms"
ON public.class_arms
FOR SELECT
TO authenticated
USING (school_id IS NOT NULL AND public.has_school_access(auth.uid(), school_id));
CREATE POLICY "School admins can manage class arms"
ON public.class_arms
FOR ALL
TO authenticated
USING (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id))
WITH CHECK (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id));

DROP POLICY IF EXISTS "Admins can manage subjects" ON public.subjects;
DROP POLICY IF EXISTS "Authenticated users can view subjects" ON public.subjects;
CREATE POLICY "School users can view subjects"
ON public.subjects
FOR SELECT
TO authenticated
USING (school_id IS NOT NULL AND public.has_school_access(auth.uid(), school_id));
CREATE POLICY "School admins can manage subjects"
ON public.subjects
FOR ALL
TO authenticated
USING (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id))
WITH CHECK (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id));

DROP POLICY IF EXISTS "Admins can manage students" ON public.students;
DROP POLICY IF EXISTS "Staff can view all students" ON public.students;
CREATE POLICY "School admins can manage students"
ON public.students
FOR ALL
TO authenticated
USING (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id))
WITH CHECK (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id));
CREATE POLICY "School teachers can view students"
ON public.students
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::public.app_role)
  AND school_id IS NOT NULL
  AND public.has_school_access(auth.uid(), school_id)
);

DROP POLICY IF EXISTS "Admins can manage teachers" ON public.teachers;
DROP POLICY IF EXISTS "Admins can view all teachers" ON public.teachers;
CREATE POLICY "School admins can manage teachers"
ON public.teachers
FOR ALL
TO authenticated
USING (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id))
WITH CHECK (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id));
CREATE POLICY "School users can view teachers"
ON public.teachers
FOR SELECT
TO authenticated
USING (school_id IS NOT NULL AND public.has_school_access(auth.uid(), school_id));

DROP POLICY IF EXISTS "Admins can manage assignments" ON public.teacher_subjects;
DROP POLICY IF EXISTS "Admins can view all assignments" ON public.teacher_subjects;
DROP POLICY IF EXISTS "Teachers can view own assignments" ON public.teacher_subjects;
CREATE POLICY "School admins can manage teacher assignments"
ON public.teacher_subjects
FOR ALL
TO authenticated
USING (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id))
WITH CHECK (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id));
CREATE POLICY "School teachers can view own assignments"
ON public.teacher_subjects
FOR SELECT
TO authenticated
USING (
  school_id IS NOT NULL
  AND public.has_school_access(auth.uid(), school_id)
  AND teacher_id IN (
    SELECT t.id FROM public.teachers t WHERE t.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins and teachers manage question banks" ON public.question_banks;
DROP POLICY IF EXISTS "Students read question banks" ON public.question_banks;
CREATE POLICY "School staff manage question banks"
ON public.question_banks
FOR ALL
TO authenticated
USING (
  school_id IS NOT NULL
  AND (
    public.is_school_admin(auth.uid(), school_id)
    OR (has_role(auth.uid(), 'teacher'::public.app_role) AND public.has_school_access(auth.uid(), school_id))
  )
)
WITH CHECK (
  school_id IS NOT NULL
  AND (
    public.is_school_admin(auth.uid(), school_id)
    OR (has_role(auth.uid(), 'teacher'::public.app_role) AND public.has_school_access(auth.uid(), school_id))
  )
);
CREATE POLICY "School students read question banks"
ON public.question_banks
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'student'::public.app_role)
  AND is_active = true
  AND school_id IS NOT NULL
  AND public.has_school_access(auth.uid(), school_id)
);

DROP POLICY IF EXISTS "Admins and teachers manage exams" ON public.cbt_exams;
DROP POLICY IF EXISTS "Students read published exams" ON public.cbt_exams;
CREATE POLICY "School staff manage exams"
ON public.cbt_exams
FOR ALL
TO authenticated
USING (
  school_id IS NOT NULL
  AND (
    public.is_school_admin(auth.uid(), school_id)
    OR (has_role(auth.uid(), 'teacher'::public.app_role) AND public.has_school_access(auth.uid(), school_id))
  )
)
WITH CHECK (
  school_id IS NOT NULL
  AND (
    public.is_school_admin(auth.uid(), school_id)
    OR (has_role(auth.uid(), 'teacher'::public.app_role) AND public.has_school_access(auth.uid(), school_id))
  )
);
CREATE POLICY "School students read published exams"
ON public.cbt_exams
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'student'::public.app_role)
  AND status = 'published'
  AND school_id IS NOT NULL
  AND public.has_school_access(auth.uid(), school_id)
);

DROP POLICY IF EXISTS "Teachers view attempts" ON public.cbt_attempts;
CREATE POLICY "School staff view attempts"
ON public.cbt_attempts
FOR SELECT
TO authenticated
USING (
  school_id IS NOT NULL
  AND (
    public.is_school_admin(auth.uid(), school_id)
    OR (has_role(auth.uid(), 'teacher'::public.app_role) AND public.has_school_access(auth.uid(), school_id))
  )
);

DROP POLICY IF EXISTS "Admins can manage all results" ON public.results;
DROP POLICY IF EXISTS "Admins can view all results" ON public.results;
CREATE POLICY "School admins can manage results"
ON public.results
FOR ALL
TO authenticated
USING (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id))
WITH CHECK (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id));
CREATE POLICY "School admins can view results"
ON public.results
FOR SELECT
TO authenticated
USING (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id));

DROP POLICY IF EXISTS "Admins can manage all result components" ON public.result_components;
CREATE POLICY "School admins can manage result components"
ON public.result_components
FOR ALL
TO authenticated
USING (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id))
WITH CHECK (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id));

DROP POLICY IF EXISTS "Admins manage fee structures" ON public.fee_structures;
DROP POLICY IF EXISTS "All read fee structures" ON public.fee_structures;
CREATE POLICY "School users can view fee structures"
ON public.fee_structures
FOR SELECT
TO authenticated
USING (school_id IS NOT NULL AND public.has_school_access(auth.uid(), school_id));
CREATE POLICY "School admins manage fee structures"
ON public.fee_structures
FOR ALL
TO authenticated
USING (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id))
WITH CHECK (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id));

DROP POLICY IF EXISTS "Admins manage payments" ON public.fee_payments;
CREATE POLICY "School admins manage fee payments"
ON public.fee_payments
FOR ALL
TO authenticated
USING (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id))
WITH CHECK (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id));

DROP POLICY IF EXISTS "Admins can manage pins" ON public.pins;
CREATE POLICY "School admins can manage pins"
ON public.pins
FOR ALL
TO authenticated
USING (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id))
WITH CHECK (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id));

DROP POLICY IF EXISTS "Admins can manage parent links" ON public.parent_students;
CREATE POLICY "School admins can manage parent links"
ON public.parent_students
FOR ALL
TO authenticated
USING (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id))
WITH CHECK (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id));

DROP POLICY IF EXISTS "Admins can view all messages" ON public.parent_teacher_messages;
CREATE POLICY "School admins can manage parent teacher messages"
ON public.parent_teacher_messages
FOR ALL
TO authenticated
USING (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id))
WITH CHECK (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id));

DROP POLICY IF EXISTS "Admins can view all preferences" ON public.notification_preferences;
CREATE POLICY "School admins can view school notification preferences"
ON public.notification_preferences
FOR SELECT
TO authenticated
USING (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id));

CREATE POLICY "Parents can view own school memberships"
ON public.parent_school_memberships
FOR SELECT
TO authenticated
USING (parent_user_id = auth.uid());

CREATE POLICY "School admins manage parent school memberships"
ON public.parent_school_memberships
FOR ALL
TO authenticated
USING (public.is_school_admin(auth.uid(), school_id))
WITH CHECK (public.is_school_admin(auth.uid(), school_id));

DROP TRIGGER IF EXISTS update_parent_school_memberships_updated_at ON public.parent_school_memberships;
CREATE TRIGGER update_parent_school_memberships_updated_at
BEFORE UPDATE ON public.parent_school_memberships
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();