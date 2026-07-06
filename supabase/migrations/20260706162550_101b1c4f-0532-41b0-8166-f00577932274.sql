
-- ============ LESSON PLANS ============
CREATE TABLE public.lesson_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  class_arm_id UUID REFERENCES public.class_arms(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  grade_level TEXT,
  duration_minutes INT DEFAULT 40,
  objectives TEXT,
  materials TEXT,
  introduction TEXT,
  main_content TEXT,
  activities TEXT,
  evaluation TEXT,
  homework TEXT,
  references_notes TEXT,
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_plans TO authenticated;
GRANT ALL ON public.lesson_plans TO service_role;
ALTER TABLE public.lesson_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own lesson plans"
  ON public.lesson_plans FOR ALL TO authenticated
  USING (teacher_user_id = auth.uid())
  WITH CHECK (teacher_user_id = auth.uid() AND public.has_school_access(auth.uid(), school_id));

CREATE POLICY "Admins view school lesson plans"
  ON public.lesson_plans FOR SELECT TO authenticated
  USING (public.is_school_admin(auth.uid(), school_id) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins delete school lesson plans"
  ON public.lesson_plans FOR DELETE TO authenticated
  USING (public.is_school_admin(auth.uid(), school_id) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_lesson_plans_updated_at BEFORE UPDATE ON public.lesson_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_lesson_plans_teacher ON public.lesson_plans(teacher_user_id, created_at DESC);
CREATE INDEX idx_lesson_plans_school ON public.lesson_plans(school_id, created_at DESC);

-- ============ ATTENDANCE ============
CREATE TABLE public.attendance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_arm_id UUID NOT NULL REFERENCES public.class_arms(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present','absent','late','excused')),
  remark TEXT,
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, attendance_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;
GRANT ALL ON public.attendance_records TO service_role;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage attendance"
  ON public.attendance_records FOR ALL TO authenticated
  USING (public.is_school_admin(auth.uid(), school_id) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.is_school_admin(auth.uid(), school_id) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Teachers manage attendance in their school"
  ON public.attendance_records FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::app_role) AND public.has_school_access(auth.uid(), school_id))
  WITH CHECK (public.has_role(auth.uid(), 'teacher'::app_role) AND public.has_school_access(auth.uid(), school_id));

CREATE POLICY "Students view own attendance"
  ON public.attendance_records FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid()));

CREATE TRIGGER trg_attendance_updated_at BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_attendance_class_date ON public.attendance_records(class_arm_id, attendance_date DESC);
CREATE INDEX idx_attendance_student ON public.attendance_records(student_id, attendance_date DESC);

-- ============ CAREER PLAN GOALS ============
CREATE TABLE public.career_plan_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed')),
  progress INT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_plan_goals TO authenticated;
GRANT ALL ON public.career_plan_goals TO service_role;
ALTER TABLE public.career_plan_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own goals"
  ON public.career_plan_goals FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid()));

CREATE POLICY "Admins view school goals"
  ON public.career_plan_goals FOR SELECT TO authenticated
  USING (public.is_school_admin(auth.uid(), school_id) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_career_goals_updated_at BEFORE UPDATE ON public.career_plan_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_career_goals_student ON public.career_plan_goals(student_id, created_at DESC);
