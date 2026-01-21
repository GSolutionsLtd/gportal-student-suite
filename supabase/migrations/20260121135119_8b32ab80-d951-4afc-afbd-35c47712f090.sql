-- Create storage bucket for school assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('school-assets', 'school-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for school assets bucket
CREATE POLICY "School assets are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'school-assets');

CREATE POLICY "Admins can upload school assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'school-assets' 
  AND public.is_admin_or_super(auth.uid())
);

CREATE POLICY "Admins can update school assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'school-assets' 
  AND public.is_admin_or_super(auth.uid())
);

CREATE POLICY "Admins can delete school assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'school-assets' 
  AND public.is_admin_or_super(auth.uid())
);