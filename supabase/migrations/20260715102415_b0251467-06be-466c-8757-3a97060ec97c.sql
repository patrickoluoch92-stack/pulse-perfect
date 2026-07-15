
-- Owner payout requests
CREATE TABLE IF NOT EXISTS public.mobility_owner_payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.mobility_private_owners(id) ON DELETE CASCADE,
  amount_kes numeric(14,2) NOT NULL CHECK (amount_kes > 0),
  method text NOT NULL DEFAULT 'mpesa' CHECK (method IN ('mpesa','bank')),
  destination jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','processing','paid','rejected','cancelled')),
  notes text,
  admin_notes text,
  processed_at timestamptz,
  processed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.mobility_owner_payout_requests TO authenticated;
GRANT ALL ON public.mobility_owner_payout_requests TO service_role;
ALTER TABLE public.mobility_owner_payout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner reads own payout requests" ON public.mobility_owner_payout_requests;
CREATE POLICY "Owner reads own payout requests" ON public.mobility_owner_payout_requests
  FOR SELECT TO authenticated
  USING (owner_id IN (SELECT id FROM public.mobility_private_owners WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Owner creates own payout requests" ON public.mobility_owner_payout_requests;
CREATE POLICY "Owner creates own payout requests" ON public.mobility_owner_payout_requests
  FOR INSERT TO authenticated
  WITH CHECK (owner_id IN (SELECT id FROM public.mobility_private_owners WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Owner cancels own pending payouts" ON public.mobility_owner_payout_requests;
CREATE POLICY "Owner cancels own pending payouts" ON public.mobility_owner_payout_requests
  FOR UPDATE TO authenticated
  USING (owner_id IN (SELECT id FROM public.mobility_private_owners WHERE user_id = auth.uid()) AND status = 'pending')
  WITH CHECK (owner_id IN (SELECT id FROM public.mobility_private_owners WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admin manages payout requests" ON public.mobility_owner_payout_requests;
CREATE POLICY "Admin manages payout requests" ON public.mobility_owner_payout_requests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_mob_payout_req_owner ON public.mobility_owner_payout_requests(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mob_payout_req_status ON public.mobility_owner_payout_requests(status);

DROP TRIGGER IF EXISTS trg_mob_payout_req_updated ON public.mobility_owner_payout_requests;
CREATE TRIGGER trg_mob_payout_req_updated BEFORE UPDATE ON public.mobility_owner_payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Review moderation audit columns
ALTER TABLE public.mobility_reviews
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderated_by uuid,
  ADD COLUMN IF NOT EXISTS moderation_reason text;
