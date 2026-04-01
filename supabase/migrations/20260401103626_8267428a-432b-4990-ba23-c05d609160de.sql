
-- Fix overly permissive policies
DROP POLICY IF EXISTS "Admins and teachers manage questions" ON public.questions;
DROP POLICY IF EXISTS "Students read questions via exams" ON public.questions;

CREATE POLICY "Admins and teachers manage questions" ON public.questions FOR ALL TO authenticated 
USING (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'teacher'))
WITH CHECK (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Students read questions" ON public.questions FOR SELECT TO authenticated 
USING (public.has_role(auth.uid(), 'student'));

-- Fix exam questions policy
DROP POLICY IF EXISTS "Teachers manage exam questions" ON public.cbt_exam_questions;
DROP POLICY IF EXISTS "Students read exam questions" ON public.cbt_exam_questions;

CREATE POLICY "Teachers manage exam questions" ON public.cbt_exam_questions FOR ALL TO authenticated 
USING (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'teacher'))
WITH CHECK (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Students read exam questions" ON public.cbt_exam_questions FOR SELECT TO authenticated 
USING (public.has_role(auth.uid(), 'student'));

-- Fix question banks policy to have WITH CHECK
DROP POLICY IF EXISTS "Admins and teachers manage question banks" ON public.question_banks;
CREATE POLICY "Admins and teachers manage question banks" ON public.question_banks FOR ALL TO authenticated 
USING (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'teacher'))
WITH CHECK (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'teacher'));
