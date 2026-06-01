-- Update default for newly created schools to include the new modular features (off by default)
ALTER TABLE public.schools
  ALTER COLUMN enabled_features
  SET DEFAULT '{"results": true, "cbt": true, "finance": true, "assignments": false, "lesson_notes": false, "careeraid": false}'::jsonb;

-- Backfill: ensure every existing school carries the new keys, without overwriting any value the user already set
UPDATE public.schools
SET enabled_features =
  jsonb_build_object(
    'assignments',  COALESCE(enabled_features->'assignments',  to_jsonb(false)),
    'lesson_notes', COALESCE(enabled_features->'lesson_notes', to_jsonb(false)),
    'careeraid',    COALESCE(enabled_features->'careeraid',    to_jsonb(false))
  ) || COALESCE(enabled_features, '{}'::jsonb)
WHERE enabled_features IS NULL
   OR NOT (enabled_features ? 'assignments')
   OR NOT (enabled_features ? 'lesson_notes')
   OR NOT (enabled_features ? 'careeraid');