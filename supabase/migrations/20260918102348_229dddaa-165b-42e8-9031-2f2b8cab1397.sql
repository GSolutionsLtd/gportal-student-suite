GRANT SELECT ON public.schools TO authenticated;
GRANT ALL ON public.schools TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_websites TO authenticated;
GRANT SELECT ON public.school_websites TO anon;
GRANT ALL ON public.school_websites TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_website_sections TO authenticated;
GRANT SELECT ON public.school_website_sections TO anon;
GRANT ALL ON public.school_website_sections TO service_role;

CREATE OR REPLACE FUNCTION public.get_public_school_site(_code text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'school', jsonb_build_object(
      'id', s.id, 'code', s.code, 'name', s.name,
      'logo_url', s.logo_url, 'motto', s.motto
    ),
    'site', jsonb_build_object(
      'id', w.id, 'school_id', w.school_id, 'is_published', w.is_published,
      'tagline', w.tagline, 'about', w.about, 'admissions_info', w.admissions_info,
      'contact_email', w.contact_email, 'contact_phone', w.contact_phone,
      'address', w.address, 'hero_image_url', w.hero_image_url,
      'theme_color', w.theme_color, 'social_links', w.social_links
    ),
    'sections', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', x.id, 'section_type', x.section_type, 'title', x.title,
        'body', x.body, 'image_url', x.image_url, 'link_url', x.link_url,
        'sort_order', x.sort_order
      ) ORDER BY x.sort_order, x.created_at)
      FROM public.school_website_sections x
      WHERE x.website_id = w.id AND x.is_published = true
    ), '[]'::jsonb)
  )
  FROM public.schools s
  JOIN public.school_websites w ON w.school_id = s.id AND w.is_published = true
  WHERE lower(s.code) = lower(_code)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_school_site(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_school_site(text) TO anon, authenticated;