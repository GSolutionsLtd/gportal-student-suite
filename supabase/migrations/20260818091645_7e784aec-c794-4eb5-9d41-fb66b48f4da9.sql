
-- 1. Session ratings ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.counselor_session_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE REFERENCES public.career_counseling_sessions(id) ON DELETE CASCADE,
  counselor_user_id uuid,
  rater_user_id uuid NOT NULL DEFAULT auth.uid(),
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.counselor_session_ratings TO authenticated;
GRANT ALL ON public.counselor_session_ratings TO service_role;
ALTER TABLE public.counselor_session_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Learners rate their own sessions" ON public.counselor_session_ratings;
CREATE POLICY "Learners rate their own sessions"
ON public.counselor_session_ratings FOR INSERT TO authenticated
WITH CHECK (
  rater_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.career_counseling_sessions s
    WHERE s.id = session_id
      AND s.status = 'completed'
      AND (
        s.subscriber_user_id = auth.uid()
        OR s.requested_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.students st WHERE st.id = s.student_id AND st.user_id = auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "Raters and counselors read ratings" ON public.counselor_session_ratings;
CREATE POLICY "Raters and counselors read ratings"
ON public.counselor_session_ratings FOR SELECT TO authenticated
USING (rater_user_id = auth.uid() OR counselor_user_id = auth.uid() OR public.is_admin_or_super(auth.uid()));

CREATE OR REPLACE FUNCTION public.set_rating_counselor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT counselor_user_id INTO NEW.counselor_user_id
  FROM public.career_counseling_sessions WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_set_rating_counselor ON public.counselor_session_ratings;
CREATE TRIGGER trg_set_rating_counselor BEFORE INSERT ON public.counselor_session_ratings
FOR EACH ROW EXECUTE FUNCTION public.set_rating_counselor();

-- 2. Active subscription helper ---------------------------------------------
CREATE OR REPLACE FUNCTION public.has_active_careeraid_subscription(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.careeraid_subscriptions
    WHERE user_id = _user_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;
GRANT EXECUTE ON FUNCTION public.has_active_careeraid_subscription(uuid) TO authenticated;

-- 3. Free tier: one assessment per calendar month -----------------------------
CREATE OR REPLACE FUNCTION public.enforce_careeraid_free_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer;
BEGIN
  IF NEW.subscriber_user_id IS NULL THEN
    RETURN NEW; -- school-affiliated students are unlimited
  END IF;
  IF public.has_active_careeraid_subscription(NEW.subscriber_user_id) THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO v_count FROM public.career_assessments
  WHERE subscriber_user_id = NEW.subscriber_user_id
    AND created_at >= date_trunc('month', now());
  IF v_count >= 1 THEN
    RAISE EXCEPTION 'Free access allows one career assessment per month. Subscribe for unlimited access.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_careeraid_free_limit ON public.career_assessments;
CREATE TRIGGER trg_careeraid_free_limit BEFORE INSERT ON public.career_assessments
FOR EACH ROW EXECUTE FUNCTION public.enforce_careeraid_free_limit();

-- 4. Counseling requires an active subscription for independent learners ------
CREATE OR REPLACE FUNCTION public.enforce_careeraid_counseling_access()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.subscriber_user_id IS NOT NULL
     AND NOT public.has_active_careeraid_subscription(NEW.subscriber_user_id) THEN
    RAISE EXCEPTION 'A CareerAid Clinic subscription is required to book counseling sessions.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_careeraid_counseling_access ON public.career_counseling_sessions;
CREATE TRIGGER trg_careeraid_counseling_access BEFORE INSERT ON public.career_counseling_sessions
FOR EACH ROW EXECUTE FUNCTION public.enforce_careeraid_counseling_access();

-- 5. Counselor directory (subscribers / school students only) -----------------
CREATE OR REPLACE FUNCTION public.list_career_counselors()
RETURNS TABLE(user_id uuid, full_name text, sessions_completed bigint, average_rating numeric)
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
         (SELECT count(*) FROM public.career_counseling_sessions cs
           WHERE cs.counselor_user_id = ur.user_id AND cs.status = 'completed') AS sessions_completed,
         (SELECT round(avg(r.rating), 2) FROM public.counselor_session_ratings r
           WHERE r.counselor_user_id = ur.user_id) AS average_rating
  FROM public.user_roles ur
  LEFT JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'counselor';
END;
$$;
GRANT EXECUTE ON FUNCTION public.list_career_counselors() TO authenticated;

-- 6. Payout: minimum 5 students in the month ----------------------------------
CREATE OR REPLACE FUNCTION public.request_counselor_payout()
RETURNS counselor_payouts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_amount numeric;
  v_count integer;
  v_payout public.counselor_payouts;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'counselor') THEN
    RAISE EXCEPTION 'Only career counselors can request payouts';
  END IF;
  IF EXTRACT(DAY FROM (now() AT TIME ZONE 'Africa/Lagos'))::int <> 28 THEN
    RAISE EXCEPTION 'Withdrawals are only available on the 28th of each month';
  END IF;

  -- Only months where at least 5 distinct students were counseled qualify.
  SELECT COALESCE(SUM(amount), 0), COUNT(*) INTO v_amount, v_count
  FROM public.counselor_wallet_entries e
  WHERE e.counselor_user_id = v_uid
    AND e.payout_id IS NULL
    AND (SELECT count(DISTINCT e2.subject_key) FROM public.counselor_wallet_entries e2
          WHERE e2.counselor_user_id = v_uid AND e2.period_month = e.period_month) >= 5;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'You must counsel at least 5 different students in a month to withdraw that month''s earnings';
  END IF;

  INSERT INTO public.counselor_payouts (counselor_user_id, period_month, amount, students_counseled)
  VALUES (v_uid, date_trunc('month', now())::date, v_amount, v_count)
  RETURNING * INTO v_payout;

  UPDATE public.counselor_wallet_entries e
  SET payout_id = v_payout.id
  WHERE e.counselor_user_id = v_uid
    AND e.payout_id IS NULL
    AND (SELECT count(DISTINCT e2.subject_key) FROM public.counselor_wallet_entries e2
          WHERE e2.counselor_user_id = v_uid AND e2.period_month = e.period_month) >= 5;

  RETURN v_payout;
END;
$$;
