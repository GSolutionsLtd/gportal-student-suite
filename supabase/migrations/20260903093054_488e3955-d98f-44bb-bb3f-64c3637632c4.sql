
ALTER TABLE public.counselor_profiles
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_code text,
  ADD COLUMN IF NOT EXISTS account_number text,
  ADD COLUMN IF NOT EXISTS account_name text,
  ADD COLUMN IF NOT EXISTS paystack_recipient_code text;

ALTER TABLE public.counselor_payouts
  ADD COLUMN IF NOT EXISTS paystack_transfer_code text,
  ADD COLUMN IF NOT EXISTS transfer_reference text,
  ADD COLUMN IF NOT EXISTS failure_reason text;

-- Allow admins to review counselors through the definer functions below
CREATE OR REPLACE FUNCTION public.counselor_profile_reset_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin_or_super(auth.uid()) THEN
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

-- Admin-safe counselor directory (no bank details exposed)
CREATE OR REPLACE FUNCTION public.admin_list_counselor_profiles()
RETURNS TABLE(
  id uuid, user_id uuid, full_name text, email text, headline text, bio text,
  qualifications text, certifications text, specializations text[], years_experience integer,
  phone text, location text, availability jsonb, status text, review_note text,
  submitted_at timestamptz, reviewed_at timestamptz,
  sessions_total bigint, sessions_completed bigint, average_rating numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  RETURN QUERY
  SELECT cp.id, cp.user_id, COALESCE(p.full_name, 'Counselor'), p.email, cp.headline, cp.bio,
         cp.qualifications, cp.certifications, cp.specializations, cp.years_experience,
         cp.phone, cp.location, cp.availability, cp.status, cp.review_note,
         cp.submitted_at, cp.reviewed_at,
         (SELECT count(*) FROM public.career_counseling_sessions s WHERE s.counselor_user_id = cp.user_id),
         (SELECT count(*) FROM public.career_counseling_sessions s WHERE s.counselor_user_id = cp.user_id AND s.status = 'completed'),
         (SELECT round(avg(r.rating), 2) FROM public.counselor_session_ratings r WHERE r.counselor_user_id = cp.user_id)
  FROM public.counselor_profiles cp
  LEFT JOIN public.profiles p ON p.id = cp.user_id
  ORDER BY cp.submitted_at DESC NULLS LAST;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_counselor(_profile_id uuid, _status text, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  IF _status NOT IN ('pending','approved','rejected') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  UPDATE public.counselor_profiles
  SET status = _status, review_note = _note, reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = _profile_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_counselor_sessions(_counselor_user_id uuid)
RETURNS TABLE(
  id uuid, scheduled_at timestamptz, status text, topic text, completed_at timestamptz,
  learner text, rating integer, review text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  RETURN QUERY
  SELECT s.id, s.scheduled_at, s.status, s.topic, s.completed_at,
         COALESCE(st.first_name || ' ' || st.last_name, sub.full_name, 'Learner'),
         r.rating, r.review
  FROM public.career_counseling_sessions s
  LEFT JOIN public.students st ON st.id = s.student_id
  LEFT JOIN public.careeraid_subscriptions sub ON sub.user_id = s.subscriber_user_id
  LEFT JOIN public.counselor_session_ratings r ON r.session_id = s.id
  WHERE s.counselor_user_id = _counselor_user_id
  ORDER BY s.scheduled_at DESC
  LIMIT 200;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_counselor_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_counselor(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_counselor_sessions(uuid) TO authenticated;
