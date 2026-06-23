
-- mpesa_transactions
CREATE TABLE IF NOT EXISTS public.mpesa_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_request_id TEXT,
  checkout_request_id TEXT NOT NULL UNIQUE,
  result_code INTEGER,
  result_desc TEXT,
  amount NUMERIC(12,2),
  mpesa_receipt_number TEXT,
  transaction_date TIMESTAMPTZ,
  phone_number TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  raw_payload JSONB,
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mpesa_tx_checkout ON public.mpesa_transactions(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_tx_receipt ON public.mpesa_transactions(mpesa_receipt_number);
CREATE INDEX IF NOT EXISTS idx_mpesa_tx_phone ON public.mpesa_transactions(phone_number);
CREATE INDEX IF NOT EXISTS idx_mpesa_tx_org ON public.mpesa_transactions(org_id);

GRANT ALL ON public.mpesa_transactions TO service_role;
ALTER TABLE public.mpesa_transactions ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies: backend (service_role) only.
CREATE POLICY "Org members can read their mpesa transactions"
  ON public.mpesa_transactions FOR SELECT TO authenticated
  USING (org_id IS NOT NULL AND public.is_org_member(auth.uid(), org_id));

CREATE TRIGGER mpesa_transactions_set_updated_at
  BEFORE UPDATE ON public.mpesa_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  actor_id UUID,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  action TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON public.audit_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read their audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (org_id IS NOT NULL AND public.is_org_member(auth.uid(), org_id));
