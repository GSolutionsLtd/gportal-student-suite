CREATE TABLE public.school_websites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL UNIQUE REFERENCES public.schools(id) ON DELETE CASCADE,
  is_published boolean NOT NULL DEFAULT false,
  tagline text,
  about text,
  admissions_info text,
  contact_email text,
  contact_phone text,
  address text,
  hero_image_url text,
  theme_color text,
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_websites TO authenticated;
GRANT SELECT ON public.school_websites TO anon;
GRANT ALL ON public.school_websites TO service_role;

ALTER TABLE public.school_websites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School admins manage own website"
ON public.school_websites FOR ALL TO authenticated
USING (public.is_school_admin(auth.uid(), school_id) OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.is_school_admin(auth.uid(), school_id) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "School members view own website"
ON public.school_websites FOR SELECT TO authenticated
USING (public.has_school_access(auth.uid(), school_id));

CREATE POLICY "Public can view published websites"
ON public.school_websites FOR SELECT TO anon
USING (is_published = true);

CREATE TRIGGER update_school_websites_updated_at
BEFORE UPDATE ON public.school_websites
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.school_website_sections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  website_id uuid NOT NULL REFERENCES public.school_websites(id) ON DELETE CASCADE,
  section_type text NOT NULL DEFAULT 'page',
  title text NOT NULL,
  slug text,
  body text,
  image_url text,
  link_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_website_sections_type_check CHECK (section_type IN ('page','news','gallery','staff','announcement')),
  CONSTRAINT school_website_sections_title_len CHECK (char_length(title) BETWEEN 1 AND 200)
);

CREATE INDEX school_website_sections_school_idx ON public.school_website_sections(school_id, section_type, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_website_sections TO authenticated;
GRANT SELECT ON public.school_website_sections TO anon;
GRANT ALL ON public.school_website_sections TO service_role;

ALTER TABLE public.school_website_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School admins manage own website sections"
ON public.school_website_sections FOR ALL TO authenticated
USING (public.is_school_admin(auth.uid(), school_id) OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.is_school_admin(auth.uid(), school_id) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "School members view own website sections"
ON public.school_website_sections FOR SELECT TO authenticated
USING (public.has_school_access(auth.uid(), school_id));

CREATE POLICY "Public can view published sections"
ON public.school_website_sections FOR SELECT TO anon
USING (
  is_published = true
  AND EXISTS (
    SELECT 1 FROM public.school_websites w
    WHERE w.id = website_id AND w.is_published = true
  )
);

CREATE TRIGGER update_school_website_sections_updated_at
BEFORE UPDATE ON public.school_website_sections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();