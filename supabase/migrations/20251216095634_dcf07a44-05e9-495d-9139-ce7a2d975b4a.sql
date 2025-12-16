
-- Allow users to insert their own role during signup
CREATE POLICY "Users can insert own role on signup"
ON public.user_roles
FOR INSERT
WITH CHECK (auth.uid() = user_id);
