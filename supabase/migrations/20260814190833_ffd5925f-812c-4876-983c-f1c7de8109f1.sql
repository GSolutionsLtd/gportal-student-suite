
-- Assignment file storage policies
-- Path convention:
--   <school_id>/assignments/<assignment_id>/<filename>
--   <school_id>/submissions/<assignment_id>/<user_id>/<filename>

CREATE POLICY "assignment_files_staff_all"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'assignment-files'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  AND public.has_school_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
  AND (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'teacher'::public.app_role))
)
WITH CHECK (
  bucket_id = 'assignment-files'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  AND public.has_school_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
  AND (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'teacher'::public.app_role))
);

CREATE POLICY "assignment_files_student_read_resources"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'assignment-files'
  AND (storage.foldername(name))[2] = 'assignments'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  AND EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.user_id = auth.uid()
      AND s.school_id = ((storage.foldername(name))[1])::uuid
  )
);

CREATE POLICY "assignment_files_student_own_submissions"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'assignment-files'
  AND (storage.foldername(name))[2] = 'submissions'
  AND (storage.foldername(name))[4] = auth.uid()::text
);

CREATE POLICY "assignment_files_student_upload_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'assignment-files'
  AND (storage.foldername(name))[2] = 'submissions'
  AND (storage.foldername(name))[4] = auth.uid()::text
  AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  AND EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.user_id = auth.uid()
      AND s.school_id = ((storage.foldername(name))[1])::uuid
  )
);

CREATE POLICY "assignment_files_student_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'assignment-files'
  AND (storage.foldername(name))[2] = 'submissions'
  AND (storage.foldername(name))[4] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'assignment-files'
  AND (storage.foldername(name))[2] = 'submissions'
  AND (storage.foldername(name))[4] = auth.uid()::text
);
