-- Add form_teacher_id column to class_arms table for persistent form teacher assignment
ALTER TABLE public.class_arms 
ADD COLUMN IF NOT EXISTS form_teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_class_arms_form_teacher_id ON public.class_arms(form_teacher_id);

-- Add comment
COMMENT ON COLUMN public.class_arms.form_teacher_id IS 'The form teacher assigned to this class arm';