-- Allow teachers to create and maintain their own teacher record (for onboarding + signature upload)
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='teachers' AND policyname='Teachers can insert own record'
  ) THEN
    CREATE POLICY "Teachers can insert own record"
    ON public.teachers
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='teachers' AND policyname='Teachers can update own record'
  ) THEN
    CREATE POLICY "Teachers can update own record"
    ON public.teachers
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
