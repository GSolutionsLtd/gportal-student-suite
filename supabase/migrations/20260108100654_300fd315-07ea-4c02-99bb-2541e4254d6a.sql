-- First, drop the existing check constraint on score_weights
ALTER TABLE public.score_weights DROP CONSTRAINT IF EXISTS valid_weights;

-- Add other_assessment_weight column to score_weights table
ALTER TABLE public.score_weights 
ADD COLUMN IF NOT EXISTS other_assessment_weight numeric NOT NULL DEFAULT 10;

-- Update default values: test1=10, test2=10, other=10, exam=70 (total = 100)
UPDATE public.score_weights 
SET test1_weight = 10, 
    test2_weight = 10, 
    other_assessment_weight = 10,
    exam_weight = 70;

-- Add new check constraint that includes other_assessment_weight
ALTER TABLE public.score_weights 
ADD CONSTRAINT valid_weights CHECK (
  test1_weight + test2_weight + other_assessment_weight + exam_weight = 100
);

-- Create notifications table for in-app notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON public.notifications
FOR UPDATE USING (auth.uid() = user_id);

-- System can insert notifications
CREATE POLICY "System can insert notifications" ON public.notifications
FOR INSERT WITH CHECK (true);

-- Add other_assessment_score column to result_components
ALTER TABLE public.result_components 
ADD COLUMN IF NOT EXISTS other_assessment_score numeric;

-- Create function to generate admission numbers
CREATE OR REPLACE FUNCTION public.generate_admission_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  year_part TEXT;
  sequence_num INT;
  new_admission_number TEXT;
BEGIN
  year_part := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(admission_number FROM '\d+$') AS INT)), 0) + 1
  INTO sequence_num
  FROM students
  WHERE admission_number LIKE year_part || '/%';
  
  new_admission_number := year_part || '/' || LPAD(sequence_num::TEXT, 4, '0');
  
  RETURN new_admission_number;
END;
$$;

-- Create function to generate PIN code
CREATE OR REPLACE FUNCTION public.generate_pin_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  pin TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..10 LOOP
    pin := pin || SUBSTRING(chars FROM FLOOR(RANDOM() * LENGTH(chars) + 1)::INT FOR 1);
  END LOOP;
  RETURN pin;
END;
$$;

-- Create function to auto-generate admission number for new students
CREATE OR REPLACE FUNCTION public.handle_new_student()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.admission_number IS NULL OR NEW.admission_number = '' THEN
    NEW.admission_number := generate_admission_number();
  END IF;
  RETURN NEW;
END;
$$;

-- Create BEFORE INSERT trigger for admission number generation
DROP TRIGGER IF EXISTS generate_student_admission_number ON public.students;
CREATE TRIGGER generate_student_admission_number
BEFORE INSERT ON public.students
FOR EACH ROW
EXECUTE FUNCTION handle_new_student();

-- Create function to create PIN after student is inserted
CREATE OR REPLACE FUNCTION public.create_student_pin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_pin_code TEXT;
  new_serial TEXT;
  current_term_id UUID;
BEGIN
  SELECT id INTO current_term_id FROM terms WHERE is_current = true LIMIT 1;
  
  LOOP
    new_pin_code := generate_pin_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM pins WHERE pin_code = new_pin_code);
  END LOOP;
  
  new_serial := 'SN-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || LPAD(FLOOR(RANDOM() * 999999 + 1)::TEXT, 6, '0');
  
  INSERT INTO pins (pin_code, serial_number, student_id, term_id, status, max_usage)
  VALUES (new_pin_code, new_serial, NEW.id, current_term_id, 'active', 5);
  
  RETURN NEW;
END;
$$;

-- Create AFTER INSERT trigger for PIN creation
DROP TRIGGER IF EXISTS create_student_pin_trigger ON public.students;
CREATE TRIGGER create_student_pin_trigger
AFTER INSERT ON public.students
FOR EACH ROW
EXECUTE FUNCTION create_student_pin();

-- Add INSERT policy for results table for teachers
DROP POLICY IF EXISTS "Teachers can insert results for assigned classes" ON public.results;
CREATE POLICY "Teachers can insert results for assigned classes" ON public.results
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'teacher'::app_role) 
  AND class_arm_id IN (
    SELECT ts.class_arm_id 
    FROM teacher_subjects ts
    JOIN teachers t ON ts.teacher_id = t.id
    WHERE t.user_id = auth.uid()
  )
);

-- Add UPDATE policy for teachers to update submitted results
DROP POLICY IF EXISTS "Teachers can update draft results" ON public.results;
CREATE POLICY "Teachers can update draft and submitted results" ON public.results
FOR UPDATE USING (
  has_role(auth.uid(), 'teacher'::app_role) 
  AND status IN ('draft', 'submitted')
  AND class_arm_id IN (
    SELECT ts.class_arm_id 
    FROM teacher_subjects ts
    JOIN teachers t ON ts.teacher_id = t.id
    WHERE t.user_id = auth.uid()
  )
);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;