-- Create school_settings table for PDF reports configuration
CREATE TABLE public.school_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name text NOT NULL DEFAULT 'My School',
  address text,
  phone text,
  email text,
  motto text,
  logo_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage school settings
CREATE POLICY "Admins can manage school settings"
ON public.school_settings
FOR ALL
USING (is_admin_or_super(auth.uid()))
WITH CHECK (is_admin_or_super(auth.uid()));

-- Everyone can view school settings (for PDF reports)
CREATE POLICY "Anyone can view school settings"
ON public.school_settings
FOR SELECT
USING (true);

-- Insert default school settings
INSERT INTO public.school_settings (school_name, address, motto)
VALUES ('My School', '123 Education Street', 'Excellence in Education');

-- Create trigger for updated_at
CREATE TRIGGER update_school_settings_updated_at
BEFORE UPDATE ON public.school_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add student_id to pins table to allow assigning pins to specific students
-- This already exists but let's ensure it works with class-based assignment