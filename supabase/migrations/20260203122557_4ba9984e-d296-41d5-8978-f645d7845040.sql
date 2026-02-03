-- Add storage policies for teachers to upload their signatures
CREATE POLICY "Teachers can upload their own signatures"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'school-assets' 
  AND (storage.foldername(name))[1] = 'teacher-signatures'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND has_role(auth.uid(), 'teacher')
);

CREATE POLICY "Teachers can update their own signatures"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'school-assets' 
  AND (storage.foldername(name))[1] = 'teacher-signatures'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND has_role(auth.uid(), 'teacher')
);

CREATE POLICY "Teachers can delete their own signatures"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'school-assets' 
  AND (storage.foldername(name))[1] = 'teacher-signatures'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND has_role(auth.uid(), 'teacher')
);