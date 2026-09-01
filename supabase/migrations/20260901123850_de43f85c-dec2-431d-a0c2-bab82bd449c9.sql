CREATE TABLE IF NOT EXISTS public.counselor_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  headline text,
  bio text,
  qualifications text,
  certifications text,
  specializations text[] NOT NULL DEFAULT '{}',
  years_experience integer NOT NULL DEFAULT 0,
  phone text,
  location text,
  availability jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT counselor_profiles_status_check CHECK (status IN ('pending','approved','rejected'))
);

GRANT SELECT, INSERT, UPDATE ON public.counselor_profiles TO authenticated;
GRANT ALL ON public.counselor_profiles TO service_role;

ALTER TABLE public.counselor_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Counselors view own profile"
ON public.counselor_profiles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Counselors create own profile"
ON public.counselor_profiles FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(), 'counselor'));

CREATE POLICY "Counselors update own profile"
ON public.counselor_profiles FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Super admins manage counselor profiles"
ON public.counselor_profiles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_counselor_profiles_updated_at
BEFORE UPDATE ON public.counselor_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Counselors editing their own profile always go back to pending review.
CREATE OR REPLACE FUNCTION public.counselor_profile_reset_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.status := OLD.status;
    END IF;
    IF (NEW.headline, NEW.bio, NEW.qualifications, NEW.certifications, NEW.specializations,
        NEW.years_experience, NEW.phone, NEW.location, NEW.availability)
       IS DISTINCT FROM
       (OLD.headline, OLD.bio, OLD.qualifications, OLD.certifications, OLD.specializations,
        OLD.years_experience, OLD.phone, OLD.location, OLD.availability) THEN
      NEW.status := 'pending';
      NEW.review_note := NULL;
      NEW.reviewed_by := NULL;
      NEW.reviewed_at := NULL;
      NEW.submitted_at := now();
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.reviewed_by := auth.uid();
    NEW.reviewed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_counselor_profile_reset_review
BEFORE UPDATE ON public.counselor_profiles
FOR EACH ROW EXECUTE FUNCTION public.counselor_profile_reset_review();

-- Directory: only approved counselors, with profile detail
DROP FUNCTION IF EXISTS public.list_career_counselors();
CREATE FUNCTION public.list_career_counselors()
RETURNS TABLE(
  user_id uuid, full_name text, headline text, specializations text[],
  years_experience integer, availability jsonb,
  sessions_completed bigint, average_rating numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in required';
  END IF;
  IF NOT public.has_active_careeraid_subscription(auth.uid())
     AND NOT EXISTS (SELECT 1 FROM public.students s WHERE s.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Subscribe to CareerAid Clinic to view available counselors.';
  END IF;

  RETURN QUERY
  SELECT ur.user_id,
         COALESCE(p.full_name, 'Career Counselor') AS full_name,
         cp.headline,
         cp.specializations,
         cp.years_experience,
         cp.availability,
         (SELECT count(*) FROM public.career_counseling_sessions cs
           WHERE cs.counselor_user_id = ur.user_id AND cs.status = 'completed') AS sessions_completed,
         (SELECT round(avg(r.rating), 2) FROM public.counselor_session_ratings r
           WHERE r.counselor_user_id = ur.user_id) AS average_rating
  FROM public.user_roles ur
  JOIN public.counselor_profiles cp ON cp.user_id = ur.user_id AND cp.status = 'approved'
  LEFT JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'counselor';
END;
$$;
GRANT EXECUTE ON FUNCTION public.list_career_counselors() TO authenticated;