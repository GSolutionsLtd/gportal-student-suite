CREATE POLICY "Users can view their own audit events"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (user_id = auth.uid());