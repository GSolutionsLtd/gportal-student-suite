
-- ============ career_assessments ============
CREATE TABLE public.career_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  realistic int NOT NULL DEFAULT 0,
  investigative int NOT NULL DEFAULT 0,
  artistic int NOT NULL DEFAULT 0,
  social int NOT NULL DEFAULT 0,
  enterprising int NOT NULL DEFAULT 0,
  conventional int NOT NULL DEFAULT 0,
  dominant_type text,
  holland_code text,
  raw_answers jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_assessments TO authenticated;
GRANT ALL ON public.career_assessments TO service_role;
ALTER TABLE public.career_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own assessments" ON public.career_assessments
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM students s WHERE s.id = student_id AND s.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM students s WHERE s.id = student_id AND s.user_id = auth.uid() AND s.school_id = career_assessments.school_id));

CREATE POLICY "School staff view assessments" ON public.career_assessments
FOR SELECT TO authenticated
USING (has_school_access(auth.uid(), school_id) AND (
  is_school_admin(auth.uid(), school_id) OR has_role(auth.uid(),'teacher'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)
));

-- ============ career_recommendations ============
CREATE TABLE public.career_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  assessment_id uuid REFERENCES public.career_assessments(id) ON DELETE SET NULL,
  summary text,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_recommendations TO authenticated;
GRANT ALL ON public.career_recommendations TO service_role;
ALTER TABLE public.career_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own recommendations" ON public.career_recommendations
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM students s WHERE s.id = student_id AND s.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM students s WHERE s.id = student_id AND s.user_id = auth.uid() AND s.school_id = career_recommendations.school_id));

CREATE POLICY "School staff view recommendations" ON public.career_recommendations
FOR SELECT TO authenticated
USING (has_school_access(auth.uid(), school_id) AND (
  is_school_admin(auth.uid(), school_id) OR has_role(auth.uid(),'teacher'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)
));

-- ============ career_recommendation_paths ============
CREATE TABLE public.career_recommendation_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL REFERENCES public.career_recommendations(id) ON DELETE CASCADE,
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  rank int NOT NULL,
  career_title text NOT NULL,
  ss_subjects text[] DEFAULT '{}',
  university_courses text[] DEFAULT '{}',
  jamb_subjects text[] DEFAULT '{}',
  jamb_cutoff text,
  universities text[] DEFAULT '{}',
  polytechnics text[] DEFAULT '{}',
  colleges_of_education text[] DEFAULT '{}',
  tech_skills text[] DEFAULT '{}',
  soft_skills text[] DEFAULT '{}',
  salary_insight text,
  market_relevance text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_recommendation_paths TO authenticated;
GRANT ALL ON public.career_recommendation_paths TO service_role;
ALTER TABLE public.career_recommendation_paths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own paths" ON public.career_recommendation_paths
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM students s WHERE s.id = student_id AND s.user_id = auth.uid()));

CREATE POLICY "Students insert own paths" ON public.career_recommendation_paths
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM students s WHERE s.id = student_id AND s.user_id = auth.uid() AND s.school_id = career_recommendation_paths.school_id));

CREATE POLICY "School staff view paths" ON public.career_recommendation_paths
FOR SELECT TO authenticated
USING (has_school_access(auth.uid(), school_id) AND (
  is_school_admin(auth.uid(), school_id) OR has_role(auth.uid(),'teacher'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)
));

CREATE POLICY "School admins manage paths" ON public.career_recommendation_paths
FOR ALL TO authenticated
USING (is_school_admin(auth.uid(), school_id))
WITH CHECK (is_school_admin(auth.uid(), school_id));

-- ============ career_counseling_sessions ============
CREATE TABLE public.career_counseling_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  counselor_user_id uuid,
  scheduled_at timestamptz NOT NULL,
  duration_minutes int NOT NULL DEFAULT 30,
  meeting_url text,
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_counseling_sessions TO authenticated;
GRANT ALL ON public.career_counseling_sessions TO service_role;
ALTER TABLE public.career_counseling_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own sessions" ON public.career_counseling_sessions
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM students s WHERE s.id = student_id AND s.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM students s WHERE s.id = student_id AND s.user_id = auth.uid() AND s.school_id = career_counseling_sessions.school_id));

CREATE POLICY "School staff view & manage sessions" ON public.career_counseling_sessions
FOR ALL TO authenticated
USING (has_school_access(auth.uid(), school_id) AND (
  is_school_admin(auth.uid(), school_id) OR has_role(auth.uid(),'teacher'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)
))
WITH CHECK (has_school_access(auth.uid(), school_id));

CREATE TRIGGER trg_counseling_updated BEFORE UPDATE ON public.career_counseling_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ career_mock_interviews ============
CREATE TABLE public.career_mock_interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  career_path text NOT NULL,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  answers jsonb DEFAULT '[]'::jsonb,
  score numeric,
  feedback text,
  status text NOT NULL DEFAULT 'in_progress',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_mock_interviews TO authenticated;
GRANT ALL ON public.career_mock_interviews TO service_role;
ALTER TABLE public.career_mock_interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own mock interviews" ON public.career_mock_interviews
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM students s WHERE s.id = student_id AND s.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM students s WHERE s.id = student_id AND s.user_id = auth.uid() AND s.school_id = career_mock_interviews.school_id));

CREATE POLICY "School staff view mock interviews" ON public.career_mock_interviews
FOR SELECT TO authenticated
USING (has_school_access(auth.uid(), school_id) AND (
  is_school_admin(auth.uid(), school_id) OR has_role(auth.uid(),'teacher'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)
));

CREATE INDEX idx_career_assess_student ON public.career_assessments(student_id, created_at DESC);
CREATE INDEX idx_career_recs_student ON public.career_recommendations(student_id, created_at DESC);
CREATE INDEX idx_career_paths_rec ON public.career_recommendation_paths(recommendation_id, rank);
CREATE INDEX idx_counseling_student ON public.career_counseling_sessions(student_id, scheduled_at DESC);
CREATE INDEX idx_mock_student ON public.career_mock_interviews(student_id, created_at DESC);
