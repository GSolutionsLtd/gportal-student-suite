
-- Career resources (school-scoped library of guidance content)
CREATE TABLE public.career_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  url text,
  posted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_resources TO authenticated;
GRANT ALL ON public.career_resources TO service_role;

ALTER TABLE public.career_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read school career resources"
  ON public.career_resources FOR SELECT TO authenticated
  USING (public.has_school_access(auth.uid(), school_id));

CREATE POLICY "Admins and teachers can insert career resources"
  ON public.career_resources FOR INSERT TO authenticated
  WITH CHECK (
    public.has_school_access(auth.uid(), school_id)
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'teacher'::public.app_role)
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    )
  );

CREATE POLICY "Admins and teachers can update career resources"
  ON public.career_resources FOR UPDATE TO authenticated
  USING (
    public.has_school_access(auth.uid(), school_id)
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'teacher'::public.app_role)
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    )
  );

CREATE POLICY "Admins and teachers can delete career resources"
  ON public.career_resources FOR DELETE TO authenticated
  USING (
    public.has_school_access(auth.uid(), school_id)
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    )
  );

CREATE TRIGGER trg_career_resources_updated_at
  BEFORE UPDATE ON public.career_resources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Student career profile
CREATE TABLE public.student_career_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL UNIQUE REFERENCES public.students(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  interests text[] NOT NULL DEFAULT '{}',
  strengths text[] NOT NULL DEFAULT '{}',
  goals text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_career_profiles TO authenticated;
GRANT ALL ON public.student_career_profiles TO service_role;

ALTER TABLE public.student_career_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Student or staff in school can read career profile"
  ON public.student_career_profiles FOR SELECT TO authenticated
  USING (
    public.has_school_access(auth.uid(), school_id)
    AND (
      EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'teacher'::public.app_role)
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    )
  );

CREATE POLICY "Student can upsert own career profile"
  ON public.student_career_profiles FOR INSERT TO authenticated
  WITH CHECK (
    public.has_school_access(auth.uid(), school_id)
    AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid())
  );

CREATE POLICY "Student can update own career profile"
  ON public.student_career_profiles FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid())
  );

CREATE TRIGGER trg_student_career_profiles_updated_at
  BEFORE UPDATE ON public.student_career_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Student saves / bookmarks
CREATE TABLE public.student_career_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.career_resources(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, resource_id)
);

GRANT SELECT, INSERT, DELETE ON public.student_career_saves TO authenticated;
GRANT ALL ON public.student_career_saves TO service_role;

ALTER TABLE public.student_career_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Student can read own saves"
  ON public.student_career_saves FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid()));

CREATE POLICY "Student can save resources"
  ON public.student_career_saves FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid()));

CREATE POLICY "Student can remove own saves"
  ON public.student_career_saves FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid()));
