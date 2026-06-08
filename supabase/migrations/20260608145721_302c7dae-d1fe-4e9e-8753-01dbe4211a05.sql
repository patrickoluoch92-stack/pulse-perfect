
CREATE TYPE public.invoice_status AS ENUM ('draft','sent','paid','void','overdue');

-- Per-org counter for invoice numbering
CREATE TABLE public.org_counters (
  org_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_seq BIGINT NOT NULL DEFAULT 0
);
GRANT SELECT ON public.org_counters TO authenticated;
GRANT ALL ON public.org_counters TO service_role;
ALTER TABLE public.org_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view counters" ON public.org_counters FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

CREATE OR REPLACE FUNCTION public.next_invoice_number(_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n BIGINT;
BEGIN
  IF NOT public.is_org_member(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;
  INSERT INTO public.org_counters (org_id, invoice_seq) VALUES (_org_id, 1)
    ON CONFLICT (org_id) DO UPDATE SET invoice_seq = public.org_counters.invoice_seq + 1
  RETURNING invoice_seq INTO n;
  RETURN 'INV-' || lpad(n::text, 6, '0');
END; $$;
GRANT EXECUTE ON FUNCTION public.next_invoice_number(UUID) TO authenticated;

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
  guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL,
  number TEXT NOT NULL,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  issued_at DATE NOT NULL DEFAULT (now()::date),
  due_at DATE,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, number)
);
CREATE INDEX idx_invoices_org ON public.invoices(org_id);
CREATE INDEX idx_invoices_reservation ON public.invoices(reservation_id);
CREATE INDEX idx_invoices_guest ON public.invoices(guest_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read invoices" ON public.invoices FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "Members insert invoices" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "Members update invoices" ON public.invoices FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), org_id))
  WITH CHECK (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "Managers delete invoices" ON public.invoices FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','manager']::public.org_role[]));

CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoice_items_invoice ON public.invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_org ON public.invoice_items(org_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items TO authenticated;
GRANT ALL ON public.invoice_items TO service_role;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read invoice_items" ON public.invoice_items FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "Members insert invoice_items" ON public.invoice_items FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "Members update invoice_items" ON public.invoice_items FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), org_id))
  WITH CHECK (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "Members delete invoice_items" ON public.invoice_items FOR DELETE TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));
