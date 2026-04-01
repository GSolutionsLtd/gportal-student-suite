
-- CBT Module Tables
CREATE TABLE public.question_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES public.subjects(id) NOT NULL,
  class_id UUID REFERENCES public.classes(id) NOT NULL,
  title TEXT NOT NULL,
  created_by UUID NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_bank_id UUID REFERENCES public.question_banks(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'multiple_choice',
  option_a TEXT,
  option_b TEXT,
  option_c TEXT,
  option_d TEXT,
  correct_answer TEXT NOT NULL,
  marks INTEGER DEFAULT 1,
  explanation TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.cbt_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) NOT NULL,
  class_arm_id UUID REFERENCES public.class_arms(id) NOT NULL,
  term_id UUID REFERENCES public.terms(id) NOT NULL,
  question_bank_id UUID REFERENCES public.question_banks(id),
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  total_marks INTEGER NOT NULL DEFAULT 100,
  pass_mark INTEGER DEFAULT 40,
  shuffle_questions BOOLEAN DEFAULT true,
  shuffle_options BOOLEAN DEFAULT false,
  show_result_immediately BOOLEAN DEFAULT true,
  max_attempts INTEGER DEFAULT 1,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  status TEXT DEFAULT 'draft',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.cbt_exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES public.cbt_exams(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  sort_order INTEGER DEFAULT 0,
  UNIQUE(exam_id, question_id)
);

CREATE TABLE public.cbt_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES public.cbt_exams(id) NOT NULL,
  student_id UUID REFERENCES public.students(id) NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  score INTEGER,
  total_marks INTEGER,
  percentage NUMERIC(5,2),
  status TEXT DEFAULT 'in_progress',
  time_spent_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.cbt_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID REFERENCES public.cbt_attempts(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.questions(id) NOT NULL,
  selected_answer TEXT,
  is_correct BOOLEAN,
  marks_awarded INTEGER DEFAULT 0,
  answered_at TIMESTAMPTZ DEFAULT now()
);

-- School Fee Payment Tables
CREATE TABLE public.fee_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  class_id UUID REFERENCES public.classes(id),
  term_id UUID REFERENCES public.terms(id),
  session_id UUID REFERENCES public.academic_sessions(id) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  is_compulsory BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.fee_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) NOT NULL,
  fee_structure_id UUID REFERENCES public.fee_structures(id) NOT NULL,
  amount_paid NUMERIC(12,2) NOT NULL,
  payment_method TEXT DEFAULT 'online',
  payment_reference TEXT,
  paystack_reference TEXT,
  status TEXT DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  receipt_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.question_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cbt_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cbt_exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cbt_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cbt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;

-- Question banks: admins/teachers can manage, students can read active ones
CREATE POLICY "Admins and teachers manage question banks" ON public.question_banks FOR ALL TO authenticated USING (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Students read question banks" ON public.question_banks FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'student') AND is_active = true);

-- Questions: same as question banks
CREATE POLICY "Admins and teachers manage questions" ON public.questions FOR ALL TO authenticated USING (true);
CREATE POLICY "Students read questions via exams" ON public.questions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'student'));

-- CBT Exams
CREATE POLICY "Admins and teachers manage exams" ON public.cbt_exams FOR ALL TO authenticated USING (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Students read published exams" ON public.cbt_exams FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'student') AND status = 'published');

-- CBT Exam Questions
CREATE POLICY "Teachers manage exam questions" ON public.cbt_exam_questions FOR ALL TO authenticated USING (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Students read exam questions" ON public.cbt_exam_questions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'student'));

-- CBT Attempts
CREATE POLICY "Students manage own attempts" ON public.cbt_attempts FOR ALL TO authenticated USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));
CREATE POLICY "Teachers view attempts" ON public.cbt_attempts FOR SELECT TO authenticated USING (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'teacher'));

-- CBT Answers
CREATE POLICY "Students manage own answers" ON public.cbt_answers FOR ALL TO authenticated USING (attempt_id IN (SELECT id FROM public.cbt_attempts WHERE student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())));
CREATE POLICY "Teachers view answers" ON public.cbt_answers FOR SELECT TO authenticated USING (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'teacher'));

-- Fee Structures: admins manage, all authenticated read
CREATE POLICY "Admins manage fee structures" ON public.fee_structures FOR ALL TO authenticated USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "All read fee structures" ON public.fee_structures FOR SELECT TO authenticated USING (true);

-- Fee Payments: admins manage all, students/parents see own
CREATE POLICY "Admins manage payments" ON public.fee_payments FOR ALL TO authenticated USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Students view own payments" ON public.fee_payments FOR SELECT TO authenticated USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));
CREATE POLICY "Parents view linked student payments" ON public.fee_payments FOR SELECT TO authenticated USING (student_id IN (SELECT student_id FROM public.parent_students WHERE parent_user_id = auth.uid() AND is_active = true));

-- Generate receipt number function
CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  receipt TEXT;
BEGIN
  receipt := 'RCT-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || LPAD(FLOOR(RANDOM() * 999999 + 1)::TEXT, 6, '0');
  RETURN receipt;
END;
$$;
