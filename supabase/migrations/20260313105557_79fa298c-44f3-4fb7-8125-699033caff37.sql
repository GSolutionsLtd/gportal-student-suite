
-- Notification preferences table
CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  sms_enabled BOOLEAN NOT NULL DEFAULT true,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
  performance_alerts BOOLEAN NOT NULL DEFAULT true,
  result_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences" ON public.notification_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own preferences" ON public.notification_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own preferences" ON public.notification_preferences
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all preferences" ON public.notification_preferences
  FOR SELECT TO authenticated USING (is_admin_or_super(auth.uid()));

-- Parent-Teacher messages table
CREATE TABLE public.parent_teacher_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id UUID NOT NULL,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  reply TEXT,
  replied_at TIMESTAMPTZ,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.parent_teacher_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view own messages" ON public.parent_teacher_messages
  FOR SELECT TO authenticated USING (parent_user_id = auth.uid());

CREATE POLICY "Parents can insert messages" ON public.parent_teacher_messages
  FOR INSERT TO authenticated WITH CHECK (parent_user_id = auth.uid() AND has_role(auth.uid(), 'parent'));

CREATE POLICY "Teachers can view messages sent to them" ON public.parent_teacher_messages
  FOR SELECT TO authenticated USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can update messages (reply)" ON public.parent_teacher_messages
  FOR UPDATE TO authenticated USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Admins can view all messages" ON public.parent_teacher_messages
  FOR ALL TO authenticated USING (is_admin_or_super(auth.uid())) WITH CHECK (is_admin_or_super(auth.uid()));
