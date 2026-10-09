CREATE TABLE public.school_payment_secrets (
  school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  paystack_secret_key text NOT NULL,
  key_last4 text NOT NULL,
  is_live boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.school_payment_secrets TO service_role;
ALTER TABLE public.school_payment_secrets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_school_paystack_key(_school_id uuid, _key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_school_admin(auth.uid(), _school_id) OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF _key IS NULL OR _key !~ '^sk_(live|test)_[A-Za-z0-9]{20,}$' THEN
    RAISE EXCEPTION 'Enter a valid Paystack secret key (starts with sk_live_ or sk_test_)';
  END IF;
  INSERT INTO public.school_payment_secrets (school_id, paystack_secret_key, key_last4, is_live, updated_by, updated_at)
  VALUES (_school_id, _key, right(_key, 4), _key LIKE 'sk_live_%', auth.uid(), now())
  ON CONFLICT (school_id) DO UPDATE SET paystack_secret_key = EXCLUDED.paystack_secret_key,
    key_last4 = EXCLUDED.key_last4, is_live = EXCLUDED.is_live, updated_by = EXCLUDED.updated_by, updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.get_school_paystack_status(_school_id uuid)
RETURNS TABLE(configured boolean, key_last4 text, is_live boolean, updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_school_admin(auth.uid(), _school_id) OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  RETURN QUERY SELECT true, s.key_last4, s.is_live, s.updated_at FROM public.school_payment_secrets s WHERE s.school_id = _school_id;
END $$;

REVOKE ALL ON FUNCTION public.set_school_paystack_key(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_school_paystack_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_school_paystack_key(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_school_paystack_status(uuid) TO authenticated;