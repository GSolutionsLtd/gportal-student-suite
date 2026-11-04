CREATE TRIGGER trg_set_school_id BEFORE INSERT ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.set_school_id_from_user();

CREATE OR REPLACE FUNCTION public.create_student_pin()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  new_pin_code TEXT;
  new_serial TEXT;
  current_term_id UUID;
BEGIN
  SELECT id INTO current_term_id FROM terms
  WHERE is_current = true AND school_id IS NOT DISTINCT FROM NEW.school_id LIMIT 1;
  LOOP
    new_pin_code := generate_pin_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM pins WHERE pin_code = new_pin_code);
  END LOOP;
  new_serial := 'SN-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || LPAD(FLOOR(RANDOM() * 999999 + 1)::TEXT, 6, '0');
  INSERT INTO pins (pin_code, serial_number, student_id, term_id, status, max_usage, school_id)
  VALUES (new_pin_code, new_serial, NEW.id, current_term_id, 'active', 5, NEW.school_id);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_school_logo_from_settings()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.school_id IS NOT NULL AND NEW.logo_url IS DISTINCT FROM OLD.logo_url THEN
    UPDATE public.schools SET logo_url = NEW.logo_url WHERE id = NEW.school_id;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.sync_school_logo_from_settings() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_sync_school_logo AFTER UPDATE ON public.school_settings
  FOR EACH ROW EXECUTE FUNCTION public.sync_school_logo_from_settings();