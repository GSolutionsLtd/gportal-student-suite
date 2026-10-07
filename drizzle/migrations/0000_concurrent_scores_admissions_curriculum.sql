
-- ===== Concurrency-safe score saving =====
CREATE OR REPLACE FUNCTION public.save_result_component(
  _student_id uuid, _term_id uuid, _class_arm_id uuid, _subject_id uuid,
  _test1 numeric, _test2 numeric, _other numeric, _exam numeric, _total numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid; v_result uuid; v_status text; v_comp uuid;
BEGIN
  SELECT school_id INTO v_school FROM public.students WHERE id = _student_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'Student not found'; END IF;
  IF NOT (public.is_school_admin(auth.uid(), v_school) OR EXISTS (
      SELECT 1 FROM public.teacher_subjects ts JOIN public.teachers t ON t.id = ts.teacher_id
      WHERE t.user_id = auth.uid() AND ts.subject_id = _subject_id AND ts.class_arm_id = _class_arm_id
        AND t.school_id = v_school)) THEN
    RAISE EXCEPTION 'You are not assigned to this subject and class';
  END IF;

  INSERT INTO public.results (student_id, term_id, class_arm_id, status, school_id)
  VALUES (_student_id, _term_id, _class_arm_id, 'draft', v_school)
  ON CONFLICT (student_id, term_id) DO NOTHING;

  SELECT id, status::text INTO v_result, v_status FROM public.results
  WHERE student_id = _student_id AND term_id = _term_id FOR UPDATE;
  IF v_status = 'published' THEN RAISE EXCEPTION 'Result already published; ask the admin to reset it'; END IF;

  INSERT INTO public.result_components (result_id, subject_id, test1_score, test2_score, other_assessment_score, exam_score, total_score, entered_by, entered_at, school_id)
  VALUES (v_result, _subject_id, _test1, _test2, _other, _exam, _total, auth.uid(), now(), v_school)
  ON CONFLICT (result_id, subject_id) DO UPDATE SET
    test1_score = EXCLUDED.test1_score, test2_score = EXCLUDED.test2_score,
    other_assessment_score = EXCLUDED.other_assessment_score, exam_score = EXCLUDED.exam_score,
    total_score = EXCLUDED.total_score, entered_by = EXCLUDED.entered_by, entered_at = now()
  RETURNING id INTO v_comp;
  RETURN v_comp;
END $$;
REVOKE EXECUTE ON FUNCTION public.save_result_component(uuid,uuid,uuid,uuid,numeric,numeric,numeric,numeric,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_result_component(uuid,uuid,uuid,uuid,numeric,numeric,numeric,numeric,numeric) TO authenticated;

-- ===== Admissions =====
CREATE TABLE public.admission_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL UNIQUE REFERENCES public.schools(id) ON DELETE CASCADE,
  is_open boolean NOT NULL DEFAULT false,
  application_fee numeric NOT NULL DEFAULT 0,
  session_label text,
  instructions text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admission_settings TO authenticated;
GRANT ALL ON public.admission_settings TO service_role;
ALTER TABLE public.admission_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members read admission settings" ON public.admission_settings FOR SELECT TO authenticated USING (public.has_school_access(auth.uid(), school_id));
CREATE POLICY "Admins manage admission settings" ON public.admission_settings FOR ALL TO authenticated USING (public.is_school_admin(auth.uid(), school_id) OR public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.is_school_admin(auth.uid(), school_id) OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.admission_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  application_number text NOT NULL UNIQUE,
  first_name text NOT NULL, last_name text NOT NULL, middle_name text,
  date_of_birth date, gender text,
  class_applying text NOT NULL, previous_school text,
  guardian_name text NOT NULL, guardian_phone text NOT NULL, guardian_email text NOT NULL,
  address text,
  status text NOT NULL DEFAULT 'submitted',
  payment_status text NOT NULL DEFAULT 'unpaid',
  payment_reference text, amount_paid numeric, paid_at timestamptz,
  exam_at timestamptz, exam_venue text, exam_score numeric,
  review_note text, reviewed_by uuid, reviewed_at timestamptz,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.admission_applications (school_id, status);
GRANT SELECT, UPDATE, DELETE ON public.admission_applications TO authenticated;
GRANT ALL ON public.admission_applications TO service_role;
ALTER TABLE public.admission_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view applications" ON public.admission_applications FOR SELECT TO authenticated USING (public.is_school_admin(auth.uid(), school_id) OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins update applications" ON public.admission_applications FOR UPDATE TO authenticated USING (public.is_school_admin(auth.uid(), school_id)) WITH CHECK (public.is_school_admin(auth.uid(), school_id));
CREATE POLICY "Admins delete applications" ON public.admission_applications FOR DELETE TO authenticated USING (public.is_school_admin(auth.uid(), school_id));
CREATE TRIGGER trg_admission_apps_updated BEFORE UPDATE ON public.admission_applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_admission_portal(_code text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('school_id', s.id, 'name', s.name, 'logo_url', s.logo_url, 'code', s.code,
    'is_open', COALESCE(a.is_open,false), 'application_fee', COALESCE(a.application_fee,0),
    'session_label', a.session_label, 'instructions', a.instructions,
    'enabled', COALESCE((s.enabled_features->>'admissions')::boolean, false))
  FROM public.schools s LEFT JOIN public.admission_settings a ON a.school_id = s.id
  WHERE lower(s.code) = lower(_code) LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.submit_admission_application(_code text, _data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid; v_open boolean; v_enabled boolean; v_num text; v_id uuid;
BEGIN
  SELECT s.id, COALESCE(a.is_open,false), COALESCE((s.enabled_features->>'admissions')::boolean,false)
  INTO v_school, v_open, v_enabled
  FROM public.schools s LEFT JOIN public.admission_settings a ON a.school_id = s.id
  WHERE lower(s.code) = lower(_code);
  IF v_school IS NULL OR NOT v_enabled OR NOT v_open THEN RAISE EXCEPTION 'Admissions are not open for this school'; END IF;
  IF length(trim(COALESCE(_data->>'first_name',''))) NOT BETWEEN 1 AND 80
     OR length(trim(COALESCE(_data->>'last_name',''))) NOT BETWEEN 1 AND 80
     OR length(trim(COALESCE(_data->>'guardian_name',''))) NOT BETWEEN 1 AND 120
     OR length(trim(COALESCE(_data->>'guardian_phone',''))) NOT BETWEEN 7 AND 20
     OR COALESCE(_data->>'guardian_email','') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     OR length(trim(COALESCE(_data->>'class_applying',''))) NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'Please fill in all required fields correctly';
  END IF;
  LOOP
    v_num := 'ADM-' || to_char(now(),'YYYY') || '-' || upper(substr(md5(random()::text),1,6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.admission_applications WHERE application_number = v_num);
  END LOOP;
  INSERT INTO public.admission_applications (school_id, application_number, first_name, last_name, middle_name,
    date_of_birth, gender, class_applying, previous_school, guardian_name, guardian_phone, guardian_email, address)
  VALUES (v_school, v_num, trim(_data->>'first_name'), trim(_data->>'last_name'), left(NULLIF(trim(_data->>'middle_name'),''),80),
    NULLIF(_data->>'date_of_birth','')::date, left(NULLIF(_data->>'gender',''),20), trim(_data->>'class_applying'),
    left(NULLIF(trim(_data->>'previous_school'),''),200), trim(_data->>'guardian_name'), trim(_data->>'guardian_phone'),
    lower(trim(_data->>'guardian_email')), left(NULLIF(trim(_data->>'address'),''),300))
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'application_number', v_num);
END $$;

CREATE OR REPLACE FUNCTION public.check_admission_status(_application_number text, _email text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('application_number', a.application_number, 'name', a.first_name||' '||a.last_name,
    'class_applying', a.class_applying, 'status', a.status, 'payment_status', a.payment_status,
    'exam_at', a.exam_at, 'exam_venue', a.exam_venue, 'review_note', a.review_note, 'school_code', s.code)
  FROM public.admission_applications a JOIN public.schools s ON s.id = a.school_id
  WHERE a.application_number = upper(trim(_application_number)) AND a.guardian_email = lower(trim(_email)) LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_admission_portal(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_admission_application(text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_admission_status(text, text) TO anon, authenticated;

-- ===== Curriculum =====
CREATE TABLE public.curriculum_schemes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL,
  week_number integer NOT NULL DEFAULT 1,
  topic text NOT NULL,
  objectives text,
  is_covered boolean NOT NULL DEFAULT false,
  covered_at timestamptz, covered_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.curriculum_schemes (school_id, class_id, subject_id, term_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculum_schemes TO authenticated;
GRANT ALL ON public.curriculum_schemes TO service_role;
ALTER TABLE public.curriculum_schemes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members read schemes" ON public.curriculum_schemes FOR SELECT TO authenticated USING (public.has_school_access(auth.uid(), school_id));
CREATE POLICY "Admins and teachers add schemes" ON public.curriculum_schemes FOR INSERT TO authenticated WITH CHECK (public.has_school_access(auth.uid(), school_id) AND (public.is_school_admin(auth.uid(), school_id) OR public.has_role(auth.uid(),'teacher')));
CREATE POLICY "Admins and teachers update schemes" ON public.curriculum_schemes FOR UPDATE TO authenticated USING (public.has_school_access(auth.uid(), school_id) AND (public.is_school_admin(auth.uid(), school_id) OR public.has_role(auth.uid(),'teacher'))) WITH CHECK (public.has_school_access(auth.uid(), school_id));
CREATE POLICY "Admins delete schemes" ON public.curriculum_schemes FOR DELETE TO authenticated USING (public.is_school_admin(auth.uid(), school_id) OR (public.has_role(auth.uid(),'teacher') AND created_by = auth.uid()));
CREATE TRIGGER trg_curriculum_schemes_updated BEFORE UPDATE ON public.curriculum_schemes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.curriculum_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  file_path text NOT NULL,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculum_documents TO authenticated;
GRANT ALL ON public.curriculum_documents TO service_role;
ALTER TABLE public.curriculum_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members read curriculum docs" ON public.curriculum_documents FOR SELECT TO authenticated USING (public.has_school_access(auth.uid(), school_id));
CREATE POLICY "Admins manage curriculum docs" ON public.curriculum_documents FOR ALL TO authenticated USING (public.is_school_admin(auth.uid(), school_id)) WITH CHECK (public.is_school_admin(auth.uid(), school_id));
