
-- Add enabled_features column to schools table for Super Admin feature control
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS enabled_features jsonb NOT NULL DEFAULT '{"results": true, "cbt": true, "finance": true}'::jsonb;
