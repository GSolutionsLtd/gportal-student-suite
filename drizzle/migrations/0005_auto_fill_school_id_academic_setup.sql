CREATE OR REPLACE FUNCTION public.set_school_id_from_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.school_id IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.school_id := public.get_user_school_id(auth.uid());
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_school_id_from_user() FROM PUBLIC, anon;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['academic_sessions','terms','classes','class_arms','subjects','grading_scales'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_school_id ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_set_school_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_school_id_from_user()', t);
  END LOOP;
END $$;