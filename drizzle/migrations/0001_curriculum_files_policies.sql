
CREATE POLICY "School members read curriculum files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'curriculum-files' AND public.has_school_access(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "Admins upload curriculum files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'curriculum-files' AND public.is_school_admin(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "Admins delete curriculum files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'curriculum-files' AND public.is_school_admin(auth.uid(), ((storage.foldername(name))[1])::uuid));
