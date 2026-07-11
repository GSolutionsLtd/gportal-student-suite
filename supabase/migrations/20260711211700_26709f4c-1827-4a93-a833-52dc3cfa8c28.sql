
DROP POLICY IF EXISTS "Users can choose one safe non-admin role on signup" ON public.user_roles;
DROP POLICY IF EXISTS "School admins can assign non-admin roles" ON public.user_roles;
