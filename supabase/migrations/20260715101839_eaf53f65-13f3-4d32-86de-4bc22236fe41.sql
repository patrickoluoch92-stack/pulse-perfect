-- Batch 7 — payout requests for private mobility owners.
CREATE TABLE IF NOT EXISTS public.mobility_owner_payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.mobility_private_owners(id) ON DELETE CASCADE,
  amount_kes numeric(12,2) NOT NULL CHECK (amount_kes > 0),
  method text NOT NULL DEFAULT 'mpesa',
  destination jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  decided_by uuid,
  decided_at timestamptz,
  external_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.mobility_owner_payout_requests TO authenticated;
GRANT ALL ON public.mobility_owner_payout_requests TO service_role;

ALTER TABLE public.mobility_owner_payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner reads own payout requests"
  ON public.mobility_owner_payout_requests FOR SELECT
  TO authenticated
  USING (owner_id IN (SELECT id FROM public.mobility_private_owners WHERE user_id = auth.uid()));

CREATE POLICY "owner creates own payout requests"
  ON public.mobility_owner_payout_requests FOR INSERT
  TO authenticated
  WITH CHECK (owner_id IN (SELECT id FROM public.mobility_private_owners WHERE user_id = auth.uid()));

CREATE POLICY "owner cancels own pending requests"
  ON public.mobility_owner_payout_requests FOR UPDATE
  TO authenticated
  USING (owner_id IN (SELECT id FROM public.mobility_private_owners WHERE user_id = auth.uid()) AND status = 'pending')
  WITH CHECK (owner_id IN (SELECT id FROM public.mobility_private_owners WHERE user_id = auth.uid()));

CREATE POLICY "platform admins manage payout requests"
  ON public.mobility_owner_payout_requests FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_mopr_owner_status ON public.mobility_owner_payout_requests(owner_id, status, created_at DESC);

CREATE TRIGGER trg_mopr_updated_at
  BEFORE UPDATE ON public.mobility_owner_payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Moderation columns on mobility_reviews if missing (approved default, moderation audit).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mobility_reviews' AND column_name='moderated_at') THEN
    ALTER TABLE public.mobility_reviews ADD COLUMN moderated_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mobility_reviews' AND column_name='moderated_by') THEN
    ALTER TABLE public.mobility_reviews ADD COLUMN moderated_by uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mobility_reviews' AND column_name='moderation_reason') THEN
    ALTER TABLE public.mobility_reviews ADD COLUMN moderation_reason text;
  END IF;
END$$;