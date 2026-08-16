
-- 1. Independent (school-free) CareerAid subscribers -------------------------
CREATE TABLE IF NOT EXISTS public.careeraid_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  class_level text,
  state_of_residence text,
  status text NOT NULL DEFAULT 'pending',
  amount numeric NOT NULL DEFAULT 5000,
  paystack_reference text UNIQUE,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_careeraid_subs_user ON public.careeraid_subscriptions(user_id);

GRANT SELECT, INSERT, UPDATE ON public.careeraid_subscriptions TO authenticated;
GRANT ALL ON public.careeraid_subscriptions TO service_role;
ALTER TABLE public.careeraid_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subscribers manage own careeraid subscription"
  ON public.careeraid_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Counselors and super admins view subscriptions"
  ON public.careeraid_subscriptions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'counselor') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_careeraid_subs_updated_at BEFORE UPDATE ON public.careeraid_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Allow CareerAid records to belong to a user instead of a school student --
ALTER TABLE public.career_assessments
  ADD COLUMN IF NOT EXISTS subscriber_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ALTER COLUMN school_id DROP NOT NULL,
  ALTER COLUMN student_id DROP NOT NULL;
ALTER TABLE public.career_recommendations
  ADD COLUMN IF NOT EXISTS subscriber_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ALTER COLUMN school_id DROP NOT NULL,
  ALTER COLUMN student_id DROP NOT NULL;
ALTER TABLE public.career_recommendation_paths
  ADD COLUMN IF NOT EXISTS subscriber_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ALTER COLUMN school_id DROP NOT NULL,
  ALTER COLUMN student_id DROP NOT NULL;
ALTER TABLE public.career_plan_goals
  ADD COLUMN IF NOT EXISTS subscriber_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ALTER COLUMN school_id DROP NOT NULL,
  ALTER COLUMN student_id DROP NOT NULL;
ALTER TABLE public.career_mock_interviews
  ADD COLUMN IF NOT EXISTS subscriber_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ALTER COLUMN school_id DROP NOT NULL,
  ALTER COLUMN student_id DROP NOT NULL;
ALTER TABLE public.career_counseling_sessions
  ADD COLUMN IF NOT EXISTS subscriber_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS requested_by uuid,
  ADD COLUMN IF NOT EXISTS topic text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ALTER COLUMN school_id DROP NOT NULL,
  ALTER COLUMN student_id DROP NOT NULL;

CREATE POLICY "Subscribers manage own assessments"
  ON public.career_assessments FOR ALL TO authenticated
  USING (subscriber_user_id = auth.uid()) WITH CHECK (subscriber_user_id = auth.uid());
CREATE POLICY "Subscribers manage own recommendations"
  ON public.career_recommendations FOR ALL TO authenticated
  USING (subscriber_user_id = auth.uid()) WITH CHECK (subscriber_user_id = auth.uid());
CREATE POLICY "Subscribers manage own recommendation paths"
  ON public.career_recommendation_paths FOR ALL TO authenticated
  USING (subscriber_user_id = auth.uid()) WITH CHECK (subscriber_user_id = auth.uid());
CREATE POLICY "Subscribers manage own goals"
  ON public.career_plan_goals FOR ALL TO authenticated
  USING (subscriber_user_id = auth.uid()) WITH CHECK (subscriber_user_id = auth.uid());
CREATE POLICY "Subscribers manage own mock interviews"
  ON public.career_mock_interviews FOR ALL TO authenticated
  USING (subscriber_user_id = auth.uid()) WITH CHECK (subscriber_user_id = auth.uid());
CREATE POLICY "Subscribers manage own counseling sessions"
  ON public.career_counseling_sessions FOR ALL TO authenticated
  USING (subscriber_user_id = auth.uid() OR requested_by = auth.uid())
  WITH CHECK (subscriber_user_id = auth.uid() OR requested_by = auth.uid());

-- 3. Counselor access to CareerAid data ---------------------------------------
CREATE POLICY "Counselors view all assessments"
  ON public.career_assessments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'counselor'));
CREATE POLICY "Counselors view all recommendations"
  ON public.career_recommendations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'counselor'));
CREATE POLICY "Counselors view all recommendation paths"
  ON public.career_recommendation_paths FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'counselor'));
CREATE POLICY "Counselors view all goals"
  ON public.career_plan_goals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'counselor'));
CREATE POLICY "Counselors manage counseling sessions"
  ON public.career_counseling_sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'counselor'))
  WITH CHECK (public.has_role(auth.uid(), 'counselor'));

-- 4. Counselor wallet ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.counselor_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  counselor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_month date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  students_counseled integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'requested',
  requested_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  notes text
);
GRANT SELECT ON public.counselor_payouts TO authenticated;
GRANT ALL ON public.counselor_payouts TO service_role;
ALTER TABLE public.counselor_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Counselors view own payouts" ON public.counselor_payouts FOR SELECT TO authenticated
  USING (counselor_user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins manage payouts" ON public.counselor_payouts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE IF NOT EXISTS public.counselor_wallet_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  counselor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.career_counseling_sessions(id) ON DELETE SET NULL,
  subject_key text NOT NULL,
  subject_label text,
  period_month date NOT NULL,
  amount numeric NOT NULL DEFAULT 2000,
  payout_id uuid REFERENCES public.counselor_payouts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (counselor_user_id, period_month, subject_key)
);
GRANT SELECT ON public.counselor_wallet_entries TO authenticated;
GRANT ALL ON public.counselor_wallet_entries TO service_role;
ALTER TABLE public.counselor_wallet_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Counselors view own wallet" ON public.counselor_wallet_entries FOR SELECT TO authenticated
  USING (counselor_user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

-- Accrue N2,000 per distinct student counseled per calendar month
CREATE OR REPLACE FUNCTION public.accrue_counselor_wallet()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_key text;
BEGIN
  IF NEW.status = 'completed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed')
     AND NEW.counselor_user_id IS NOT NULL THEN
    v_key := COALESCE(NEW.student_id::text, NEW.subscriber_user_id::text);
    IF v_key IS NOT NULL THEN
      INSERT INTO public.counselor_wallet_entries (counselor_user_id, session_id, subject_key, period_month)
      VALUES (NEW.counselor_user_id, NEW.id, v_key, date_trunc('month', COALESCE(NEW.completed_at, now()))::date)
      ON CONFLICT (counselor_user_id, period_month, subject_key) DO NOTHING;
    END IF;
    IF NEW.completed_at IS NULL THEN NEW.completed_at := now(); END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.accrue_counselor_wallet() FROM public;

DROP TRIGGER IF EXISTS trg_accrue_counselor_wallet ON public.career_counseling_sessions;
CREATE TRIGGER trg_accrue_counselor_wallet
  BEFORE INSERT OR UPDATE ON public.career_counseling_sessions
  FOR EACH ROW EXECUTE FUNCTION public.accrue_counselor_wallet();

-- Withdrawals allowed only on the 28th of the month
CREATE OR REPLACE FUNCTION public.request_counselor_payout()
RETURNS public.counselor_payouts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  SELECT COALESCE(SUM(amount), 0), COUNT(*) INTO v_amount, v_count
  FROM public.counselor_wallet_entries
  WHERE counselor_user_id = v_uid AND payout_id IS NULL;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Your wallet balance is empty';
  END IF;

  INSERT INTO public.counselor_payouts (counselor_user_id, period_month, amount, students_counseled)
  VALUES (v_uid, date_trunc('month', now())::date, v_amount, v_count)
  RETURNING * INTO v_payout;

  UPDATE public.counselor_wallet_entries
  SET payout_id = v_payout.id
  WHERE counselor_user_id = v_uid AND payout_id IS NULL;

  RETURN v_payout;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.request_counselor_payout() FROM public;
GRANT EXECUTE ON FUNCTION public.request_counselor_payout() TO authenticated;
