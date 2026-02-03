-- Add form_teacher_id column to results table
ALTER TABLE public.results 
ADD COLUMN IF NOT EXISTS form_teacher_id uuid REFERENCES public.teachers(id);

-- Add an index for better performance
CREATE INDEX IF NOT EXISTS idx_results_form_teacher_id ON public.results(form_teacher_id);