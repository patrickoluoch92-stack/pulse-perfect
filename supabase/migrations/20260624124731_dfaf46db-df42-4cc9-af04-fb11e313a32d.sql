
CREATE TABLE public.marketplace_availability_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.marketplace_properties(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX idx_mkt_blocks_property ON public.marketplace_availability_blocks(property_id);
CREATE INDEX idx_mkt_blocks_range ON public.marketplace_availability_blocks(property_id, start_date, end_date);

GRANT SELECT ON public.marketplace_availability_blocks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_availability_blocks TO authenticated;
GRANT ALL ON public.marketplace_availability_blocks TO service_role;

ALTER TABLE public.marketplace_availability_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read blocks for approved properties"
  ON public.marketplace_availability_blocks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.marketplace_properties p
      WHERE p.id = property_id AND p.status = 'approved'
    )
  );

CREATE POLICY "Org members manage their blocks"
  ON public.marketplace_availability_blocks FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.marketplace_properties p
      JOIN public.organization_members m ON m.org_id = p.org_id
      WHERE p.id = property_id AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.marketplace_properties p
      JOIN public.organization_members m ON m.org_id = p.org_id
      WHERE p.id = property_id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins manage all blocks"
  ON public.marketplace_availability_blocks FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
