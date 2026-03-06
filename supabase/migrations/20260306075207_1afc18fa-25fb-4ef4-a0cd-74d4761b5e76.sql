
-- Create parent_students linking table
CREATE TABLE public.parent_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id uuid NOT NULL,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  relationship text NOT NULL DEFAULT 'guardian',
  linked_at timestamp with time zone NOT NULL DEFAULT now(),
  linked_by uuid,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(parent_user_id, student_id)
);

-- Enable RLS
ALTER TABLE public.parent_students ENABLE ROW LEVEL SECURITY;

-- Parents can view their own linked students
CREATE POLICY "Parents can view own links" ON public.parent_students
  FOR SELECT TO authenticated
  USING (parent_user_id = auth.uid());

-- Admins can manage all parent-student links
CREATE POLICY "Admins can manage parent links" ON public.parent_students
  FOR ALL TO authenticated
  USING (is_admin_or_super(auth.uid()))
  WITH CHECK (is_admin_or_super(auth.uid()));

-- Parents can view results of their linked students (published only)
CREATE POLICY "Parents can view linked student results" ON public.results
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'parent'::app_role) AND
    student_id IN (
      SELECT ps.student_id FROM public.parent_students ps
      WHERE ps.parent_user_id = auth.uid() AND ps.is_active = true
    ) AND status = 'published'::result_status
  );

-- Parents can view result components of linked students
CREATE POLICY "Parents can view linked student result components" ON public.result_components
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'parent'::app_role) AND
    result_id IN (
      SELECT r.id FROM results r
      JOIN parent_students ps ON r.student_id = ps.student_id
      WHERE ps.parent_user_id = auth.uid() AND ps.is_active = true
      AND r.status = 'published'::result_status
    )
  );

-- Parents can view linked student profiles
CREATE POLICY "Parents can view linked students" ON public.students
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'parent'::app_role) AND
    id IN (
      SELECT ps.student_id FROM public.parent_students ps
      WHERE ps.parent_user_id = auth.uid() AND ps.is_active = true
    )
  );
