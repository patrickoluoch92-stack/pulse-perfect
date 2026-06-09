ALTER TABLE public.app_errors
  ADD COLUMN IF NOT EXISTS action text,
  ADD COLUMN IF NOT EXISTS correlation_id text;

CREATE INDEX IF NOT EXISTS app_errors_correlation_idx
  ON public.app_errors (correlation_id)
  WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS app_errors_action_idx
  ON public.app_errors (action, created_at DESC)
  WHERE action IS NOT NULL;