-- Create schools table for multi-tenant SaaS
CREATE TABLE public.schools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  motto TEXT,
  subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'suspended', 'expired')),
  subscription_ends_at TIMESTAMP WITH TIME ZONE,
  max_students INTEGER DEFAULT 100,
  max_teachers INTEGER DEFAULT 20,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create school_admins junction table first (before referencing it in policy)
CREATE TABLE public.school_admins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(school_id, user_id)
);

-- Enable RLS for schools
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything with schools
CREATE POLICY "Super admins can manage schools"
ON public.schools
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

-- School admins can view their own school
CREATE POLICY "Admins can view their school"
ON public.schools
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.school_admins
    WHERE school_admins.school_id = schools.id
    AND school_admins.user_id = auth.uid()
  )
);

ALTER TABLE public.school_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage school admins"
ON public.school_admins
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "School admins can view their school admins"
ON public.school_admins
FOR SELECT
USING (user_id = auth.uid());

-- Create trigger for updated_at on schools
CREATE TRIGGER update_schools_updated_at
BEFORE UPDATE ON public.schools
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create student_analytics view for performance tracking
CREATE OR REPLACE VIEW public.student_performance_analytics AS
SELECT 
  r.student_id,
  r.term_id,
  t.name as term_name,
  t.term_type,
  s.name as session_name,
  r.average_score,
  r.class_position,
  r.total_score,
  st.first_name,
  st.last_name,
  st.admission_number,
  ca.name as class_arm_name,
  c.name as class_name,
  c.level as class_level
FROM results r
JOIN terms t ON r.term_id = t.id
JOIN academic_sessions s ON t.session_id = s.id
JOIN students st ON r.student_id = st.id
JOIN class_arms ca ON r.class_arm_id = ca.id
JOIN classes c ON ca.class_id = c.id
WHERE r.status = 'published';

-- Grant access to the view
GRANT SELECT ON public.student_performance_analytics TO authenticated;