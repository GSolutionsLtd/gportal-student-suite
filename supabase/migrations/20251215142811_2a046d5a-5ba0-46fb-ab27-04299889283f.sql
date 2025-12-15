
-- Step 2: Complete Database Schema for SRMS (GPortal Suite)

-- ===========================================
-- 1. ENUMS
-- ===========================================
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'teacher', 'student');
CREATE TYPE public.term_type AS ENUM ('first', 'second', 'third');
CREATE TYPE public.result_status AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'published');
CREATE TYPE public.pin_status AS ENUM ('active', 'used', 'expired', 'deactivated');
CREATE TYPE public.audit_action AS ENUM ('create', 'update', 'delete', 'login', 'logout', 'approve', 'reject', 'publish', 'unpublish');

-- ===========================================
-- 2. PROFILES TABLE
-- ===========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_is_active ON public.profiles(is_active);

-- ===========================================
-- 3. USER ROLES TABLE (Critical for security)
-- ===========================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);

-- ===========================================
-- 4. SECURITY DEFINER FUNCTIONS
-- ===========================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_super(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'super_admin')
  )
$$;

-- ===========================================
-- 5. ACADEMIC SESSIONS TABLE
-- ===========================================
CREATE TABLE public.academic_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_session_dates CHECK (end_date > start_date)
);

CREATE INDEX idx_academic_sessions_is_current ON public.academic_sessions(is_current);
CREATE INDEX idx_academic_sessions_dates ON public.academic_sessions(start_date, end_date);

-- ===========================================
-- 6. TERMS TABLE
-- ===========================================
CREATE TABLE public.terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  term_type term_type NOT NULL,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  result_entry_deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, term_type),
  CONSTRAINT valid_term_dates CHECK (end_date > start_date)
);

CREATE INDEX idx_terms_session_id ON public.terms(session_id);
CREATE INDEX idx_terms_is_current ON public.terms(is_current);

-- ===========================================
-- 7. CLASSES TABLE
-- ===========================================
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  level INTEGER NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_classes_level ON public.classes(level);
CREATE INDEX idx_classes_is_active ON public.classes(is_active);

-- ===========================================
-- 8. CLASS ARMS TABLE
-- ===========================================
CREATE TABLE public.class_arms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  capacity INTEGER DEFAULT 40,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, name)
);

CREATE INDEX idx_class_arms_class_id ON public.class_arms(class_id);

-- ===========================================
-- 9. SUBJECTS TABLE
-- ===========================================
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subjects_code ON public.subjects(code);
CREATE INDEX idx_subjects_is_active ON public.subjects(is_active);

-- ===========================================
-- 10. CLASS SUBJECTS MAPPING
-- ===========================================
CREATE TABLE public.class_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  is_compulsory BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, subject_id)
);

CREATE INDEX idx_class_subjects_class_id ON public.class_subjects(class_id);
CREATE INDEX idx_class_subjects_subject_id ON public.class_subjects(subject_id);

-- ===========================================
-- 11. GRADING SCALES TABLE
-- ===========================================
CREATE TABLE public.grading_scales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_score NUMERIC(5,2) NOT NULL,
  max_score NUMERIC(5,2) NOT NULL,
  grade TEXT NOT NULL,
  remark TEXT NOT NULL,
  grade_point NUMERIC(3,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_score_range CHECK (max_score >= min_score),
  CONSTRAINT valid_scores CHECK (min_score >= 0 AND max_score <= 100)
);

CREATE INDEX idx_grading_scales_scores ON public.grading_scales(min_score, max_score);

-- ===========================================
-- 12. STUDENTS TABLE
-- ===========================================
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  admission_number TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  middle_name TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male', 'female')),
  current_class_arm_id UUID REFERENCES public.class_arms(id),
  admission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  guardian_name TEXT,
  guardian_phone TEXT,
  guardian_email TEXT,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_students_admission_number ON public.students(admission_number);
CREATE INDEX idx_students_current_class ON public.students(current_class_arm_id);
CREATE INDEX idx_students_user_id ON public.students(user_id);
CREATE INDEX idx_students_is_active ON public.students(is_active);
CREATE INDEX idx_students_name ON public.students(last_name, first_name);

-- ===========================================
-- 13. TEACHERS TABLE
-- ===========================================
CREATE TABLE public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_id TEXT NOT NULL UNIQUE,
  qualification TEXT,
  specialization TEXT,
  date_joined DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_teachers_staff_id ON public.teachers(staff_id);
CREATE INDEX idx_teachers_user_id ON public.teachers(user_id);
CREATE INDEX idx_teachers_is_active ON public.teachers(is_active);

-- ===========================================
-- 14. TEACHER SUBJECT ASSIGNMENTS
-- ===========================================
CREATE TABLE public.teacher_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  class_arm_id UUID NOT NULL REFERENCES public.class_arms(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  UNIQUE (teacher_id, subject_id, class_arm_id, session_id)
);

CREATE INDEX idx_teacher_subjects_teacher ON public.teacher_subjects(teacher_id);
CREATE INDEX idx_teacher_subjects_class_arm ON public.teacher_subjects(class_arm_id);
CREATE INDEX idx_teacher_subjects_session ON public.teacher_subjects(session_id);

-- ===========================================
-- 15. RESULT SCORE WEIGHTS
-- ===========================================
CREATE TABLE public.score_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  test1_weight NUMERIC(5,2) NOT NULL DEFAULT 10,
  test2_weight NUMERIC(5,2) NOT NULL DEFAULT 20,
  exam_weight NUMERIC(5,2) NOT NULL DEFAULT 70,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id),
  CONSTRAINT valid_weights CHECK (test1_weight + test2_weight + exam_weight = 100)
);

-- ===========================================
-- 16. RESULTS TABLE (Header)
-- ===========================================
CREATE TABLE public.results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  term_id UUID NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  class_arm_id UUID NOT NULL REFERENCES public.class_arms(id),
  total_score NUMERIC(7,2),
  average_score NUMERIC(5,2),
  class_position INTEGER,
  status result_status NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  published_at TIMESTAMPTZ,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, term_id)
);

CREATE INDEX idx_results_student ON public.results(student_id);
CREATE INDEX idx_results_term ON public.results(term_id);
CREATE INDEX idx_results_class_arm ON public.results(class_arm_id);
CREATE INDEX idx_results_status ON public.results(status);

-- ===========================================
-- 17. RESULT COMPONENTS (Subject Scores)
-- ===========================================
CREATE TABLE public.result_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id UUID NOT NULL REFERENCES public.results(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id),
  test1_score NUMERIC(5,2) CHECK (test1_score >= 0 AND test1_score <= 100),
  test2_score NUMERIC(5,2) CHECK (test2_score >= 0 AND test2_score <= 100),
  exam_score NUMERIC(5,2) CHECK (exam_score >= 0 AND exam_score <= 100),
  total_score NUMERIC(5,2),
  weighted_score NUMERIC(5,2),
  grade TEXT,
  remark TEXT,
  subject_position INTEGER,
  entered_by UUID REFERENCES auth.users(id),
  entered_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (result_id, subject_id)
);

CREATE INDEX idx_result_components_result ON public.result_components(result_id);
CREATE INDEX idx_result_components_subject ON public.result_components(subject_id);

-- ===========================================
-- 18. PINS TABLE
-- ===========================================
CREATE TABLE public.pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_code TEXT NOT NULL UNIQUE,
  serial_number TEXT NOT NULL UNIQUE,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  term_id UUID REFERENCES public.terms(id),
  status pin_status NOT NULL DEFAULT 'active',
  max_usage INTEGER NOT NULL DEFAULT 5,
  usage_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  generated_by UUID REFERENCES auth.users(id),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pins_pin_code ON public.pins(pin_code);
CREATE INDEX idx_pins_serial ON public.pins(serial_number);
CREATE INDEX idx_pins_student ON public.pins(student_id);
CREATE INDEX idx_pins_status ON public.pins(status);

-- ===========================================
-- 19. PIN USAGE LOG
-- ===========================================
CREATE TABLE public.pin_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_id UUID NOT NULL REFERENCES public.pins(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id),
  ip_address TEXT,
  user_agent TEXT,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pin_usage_pin ON public.pin_usage_logs(pin_id);
CREATE INDEX idx_pin_usage_student ON public.pin_usage_logs(student_id);

-- ===========================================
-- 20. AUDIT LOGS TABLE
-- ===========================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action audit_action NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_table ON public.audit_logs(table_name);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- ===========================================
-- 21. ENABLE ROW LEVEL SECURITY
-- ===========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_arms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grading_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.result_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pin_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- 22. RLS POLICIES - PROFILES
-- ===========================================
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "System can insert profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- ===========================================
-- 23. RLS POLICIES - USER ROLES
-- ===========================================
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Super admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- ===========================================
-- 24. RLS POLICIES - ACADEMIC DATA (Read by all authenticated)
-- ===========================================
CREATE POLICY "Authenticated users can view sessions"
  ON public.academic_sessions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage sessions"
  ON public.academic_sessions FOR ALL
  TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Authenticated users can view terms"
  ON public.terms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage terms"
  ON public.terms FOR ALL
  TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Authenticated users can view classes"
  ON public.classes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage classes"
  ON public.classes FOR ALL
  TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Authenticated users can view class arms"
  ON public.class_arms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage class arms"
  ON public.class_arms FOR ALL
  TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Authenticated users can view subjects"
  ON public.subjects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage subjects"
  ON public.subjects FOR ALL
  TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Authenticated users can view class subjects"
  ON public.class_subjects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage class subjects"
  ON public.class_subjects FOR ALL
  TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Authenticated users can view grading scales"
  ON public.grading_scales FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage grading scales"
  ON public.grading_scales FOR ALL
  TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Authenticated users can view score weights"
  ON public.score_weights FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage score weights"
  ON public.score_weights FOR ALL
  TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

-- ===========================================
-- 25. RLS POLICIES - STUDENTS
-- ===========================================
CREATE POLICY "Students can view own record"
  ON public.students FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Staff can view all students"
  ON public.students FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_super(auth.uid()) OR
    public.has_role(auth.uid(), 'teacher')
  );

CREATE POLICY "Admins can manage students"
  ON public.students FOR ALL
  TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

-- ===========================================
-- 26. RLS POLICIES - TEACHERS
-- ===========================================
CREATE POLICY "Teachers can view own record"
  ON public.teachers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all teachers"
  ON public.teachers FOR SELECT
  TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can manage teachers"
  ON public.teachers FOR ALL
  TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

-- ===========================================
-- 27. RLS POLICIES - TEACHER SUBJECTS
-- ===========================================
CREATE POLICY "Teachers can view own assignments"
  ON public.teacher_subjects FOR SELECT
  TO authenticated
  USING (
    teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can view all assignments"
  ON public.teacher_subjects FOR SELECT
  TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can manage assignments"
  ON public.teacher_subjects FOR ALL
  TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

-- ===========================================
-- 28. RLS POLICIES - RESULTS
-- ===========================================
CREATE POLICY "Students can view own published results"
  ON public.results FOR SELECT
  TO authenticated
  USING (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
    AND status = 'published'
  );

CREATE POLICY "Teachers can view results for assigned classes"
  ON public.results FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'teacher') AND
    class_arm_id IN (
      SELECT ts.class_arm_id FROM public.teacher_subjects ts
      JOIN public.teachers t ON ts.teacher_id = t.id
      WHERE t.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all results"
  ON public.results FOR SELECT
  TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can manage all results"
  ON public.results FOR ALL
  TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Teachers can update draft results"
  ON public.results FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'teacher') AND
    status = 'draft' AND
    class_arm_id IN (
      SELECT ts.class_arm_id FROM public.teacher_subjects ts
      JOIN public.teachers t ON ts.teacher_id = t.id
      WHERE t.user_id = auth.uid()
    )
  );

-- ===========================================
-- 29. RLS POLICIES - RESULT COMPONENTS
-- ===========================================
CREATE POLICY "Students can view own published result components"
  ON public.result_components FOR SELECT
  TO authenticated
  USING (
    result_id IN (
      SELECT r.id FROM public.results r
      JOIN public.students s ON r.student_id = s.id
      WHERE s.user_id = auth.uid() AND r.status = 'published'
    )
  );

CREATE POLICY "Teachers can view/manage assigned result components"
  ON public.result_components FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'teacher') AND
    result_id IN (
      SELECT r.id FROM public.results r
      WHERE r.class_arm_id IN (
        SELECT ts.class_arm_id FROM public.teacher_subjects ts
        JOIN public.teachers t ON ts.teacher_id = t.id
        WHERE t.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage all result components"
  ON public.result_components FOR ALL
  TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

-- ===========================================
-- 30. RLS POLICIES - PINS (Public access for checking)
-- ===========================================
CREATE POLICY "Anyone can verify pins"
  ON public.pins FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can manage pins"
  ON public.pins FOR ALL
  TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Anyone can log pin usage"
  ON public.pin_usage_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view pin logs"
  ON public.pin_usage_logs FOR SELECT
  TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

-- ===========================================
-- 31. RLS POLICIES - AUDIT LOGS
-- ===========================================
CREATE POLICY "Super admins can view audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ===========================================
-- 32. TRIGGERS FOR UPDATED_AT
-- ===========================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_academic_sessions_updated_at
  BEFORE UPDATE ON public.academic_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_terms_updated_at
  BEFORE UPDATE ON public.terms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_classes_updated_at
  BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_class_arms_updated_at
  BEFORE UPDATE ON public.class_arms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subjects_updated_at
  BEFORE UPDATE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_grading_scales_updated_at
  BEFORE UPDATE ON public.grading_scales
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_teachers_updated_at
  BEFORE UPDATE ON public.teachers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_score_weights_updated_at
  BEFORE UPDATE ON public.score_weights
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_results_updated_at
  BEFORE UPDATE ON public.results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_result_components_updated_at
  BEFORE UPDATE ON public.result_components
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- 33. PROFILE CREATION TRIGGER
-- ===========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
