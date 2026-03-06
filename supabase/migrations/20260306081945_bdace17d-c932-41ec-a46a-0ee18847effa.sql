
-- Module 3: Add verification_code to results
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS verification_code text UNIQUE;

-- Create function to generate unique verification code
CREATE OR REPLACE FUNCTION public.generate_verification_code()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
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

-- Auto-generate verification code on result publish
CREATE OR REPLACE FUNCTION public.auto_generate_verification_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_code TEXT;
BEGIN
  IF NEW.status = 'published' AND (OLD.status IS DISTINCT FROM 'published') AND NEW.verification_code IS NULL THEN
    LOOP
      new_code := generate_verification_code();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM results WHERE verification_code = new_code);
    END LOOP;
    NEW.verification_code := new_code;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_verification_code
  BEFORE UPDATE ON public.results
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_verification_code();

-- Module 4: Add pin_type and price to pins
ALTER TABLE public.pins ADD COLUMN IF NOT EXISTS pin_type text NOT NULL DEFAULT 'multi_use';
ALTER TABLE public.pins ADD COLUMN IF NOT EXISTS price numeric NOT NULL DEFAULT 0;
