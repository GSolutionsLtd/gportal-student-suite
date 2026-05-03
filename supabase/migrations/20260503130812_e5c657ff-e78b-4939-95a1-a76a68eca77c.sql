-- Admin invites table
CREATE TABLE IF NOT EXISTS public.admin_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  email TEXT,
  created_by UUID NOT NULL,
  used_by UUID,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_invites_school_id_idx ON public.admin_invites(school_id);
CREATE INDEX IF NOT EXISTS admin_invites_code_idx ON public.admin_invites(code);

ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;

-- Only super admins can manage
CREATE POLICY "Super admins manage admin invites"
ON public.admin_invites
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- Helper function to generate readable code
CREATE OR REPLACE FUNCTION public.generate_admin_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..12 LOOP
    code := code || SUBSTRING(chars FROM FLOOR(RANDOM() * LENGTH(chars) + 1)::INT FOR 1);
  END LOOP;
  RETURN code;
END;
$$;

-- Public-safe validator: returns school info if invite is valid, NULL otherwise.
-- Accepts the invite code and returns minimal info needed for signup UI.
CREATE OR REPLACE FUNCTION public.validate_admin_invite(_code TEXT)
RETURNS TABLE(school_id UUID, school_code TEXT, school_name TEXT, email TEXT)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.code, s.name, ai.email
  FROM public.admin_invites ai
  JOIN public.schools s ON s.id = ai.school_id
  WHERE ai.code = upper(trim(_code))
    AND ai.used_at IS NULL
    AND ai.expires_at > now()
    AND s.subscription_status IN ('trial','active')
    AND NOT EXISTS (
      SELECT 1 FROM public.school_admins sa
      WHERE sa.school_id = ai.school_id
        AND COALESCE(sa.is_primary, true) = true
    )
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.validate_admin_invite(TEXT) TO anon, authenticated;