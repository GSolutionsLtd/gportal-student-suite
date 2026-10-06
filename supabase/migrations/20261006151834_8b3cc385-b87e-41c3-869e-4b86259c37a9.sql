CREATE OR REPLACE FUNCTION public.super_admin_schools_overview()
RETURNS TABLE(
  id uuid, code text, name text, logo_url text, subscription_status text, subscription_ends_at timestamptz,
  website_published boolean, website_sections bigint,
  staff_total bigint, teachers_approved bigint, teachers_pending bigint, students_total bigint,
  fee_structures bigint, fees_collected numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  RETURN QUERY
  SELECT s.id, s.code, s.name, s.logo_url, s.subscription_status, s.subscription_ends_at,
    COALESCE((SELECT w.is_published FROM public.school_websites w WHERE w.school_id = s.id LIMIT 1), false),
    (SELECT count(*) FROM public.school_website_sections x WHERE x.school_id = s.id),
    (SELECT count(*) FROM public.teachers t WHERE t.school_id = s.id),
    (SELECT count(*) FROM public.teachers t WHERE t.school_id = s.id AND t.approval_status = 'approved'),
    (SELECT count(*) FROM public.teachers t WHERE t.school_id = s.id AND t.approval_status = 'pending'),
    (SELECT count(*) FROM public.students st WHERE st.school_id = s.id),
    (SELECT count(*) FROM public.fee_structures f WHERE f.school_id = s.id),
    (SELECT COALESCE(sum(p.amount_paid), 0) FROM public.fee_payments p WHERE p.school_id = s.id AND p.status = 'success')
  FROM public.schools s
  ORDER BY s.name;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.super_admin_schools_overview() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.super_admin_schools_overview() TO authenticated;