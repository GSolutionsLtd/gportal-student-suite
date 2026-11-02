DROP POLICY IF EXISTS "Anyone can submit contact requests" ON public.contact_submissions;
CREATE POLICY "Anyone can submit contact requests" ON public.contact_submissions FOR INSERT TO anon, authenticated
WITH CHECK (
  status = 'new'
  AND length(trim(full_name)) BETWEEN 1 AND 200
  AND length(trim(school_name)) BETWEEN 1 AND 300
  AND length(city_state) BETWEEN 1 AND 300
  AND length(email) BETWEEN 3 AND 255 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND length(phone) BETWEEN 1 AND 40
  AND length(trim(message)) BETWEEN 1 AND 5000
  AND (source IS NULL OR length(source) <= 200)
);
DROP POLICY IF EXISTS "Anyone can log tour clicks" ON public.product_tour_clicks;
CREATE POLICY "Anyone can log tour clicks" ON public.product_tour_clicks FOR INSERT TO anon, authenticated
WITH CHECK (
  (source IS NULL OR length(source) <= 200)
  AND (user_agent IS NULL OR length(user_agent) <= 1000)
);