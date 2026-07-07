
-- Housekeeping tasks
CREATE TABLE public.housekeeping_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid references public.marketplace_properties(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  title text not null,
  notes text,
  scheduled_for date not null,
  status text not null default 'pending' check (status in ('pending','in_progress','done','skipped')),
  assignee_id uuid references auth.users(id) on delete set null,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.housekeeping_tasks TO authenticated;
GRANT ALL ON public.housekeeping_tasks TO service_role;
ALTER TABLE public.housekeeping_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hk org members read" ON public.housekeeping_tasks FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "hk org members insert" ON public.housekeeping_tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "hk org members update" ON public.housekeeping_tasks FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), org_id))
  WITH CHECK (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "hk org members delete" ON public.housekeeping_tasks FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::org_role[]));
CREATE INDEX hk_org_scheduled_idx ON public.housekeeping_tasks (org_id, scheduled_for);
CREATE INDEX hk_status_idx ON public.housekeeping_tasks (org_id, status);
CREATE TRIGGER hk_set_updated_at BEFORE UPDATE ON public.housekeeping_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Maintenance tickets
CREATE TABLE public.maintenance_tickets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid references public.marketplace_properties(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  title text not null,
  description text,
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  reported_by uuid references auth.users(id) on delete set null,
  assignee_id uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_tickets TO authenticated;
GRANT ALL ON public.maintenance_tickets TO service_role;
ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mt org members read" ON public.maintenance_tickets FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "mt org members insert" ON public.maintenance_tickets FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "mt org members update" ON public.maintenance_tickets FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), org_id))
  WITH CHECK (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "mt org members delete" ON public.maintenance_tickets FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::org_role[]));
CREATE INDEX mt_org_status_idx ON public.maintenance_tickets (org_id, status);
CREATE TRIGGER mt_set_updated_at BEFORE UPDATE ON public.maintenance_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Platform-wide coupons managed by admins
CREATE TABLE public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type text not null check (discount_type in ('percent','fixed')),
  discount_value numeric(10,2) not null check (discount_value > 0),
  currency text not null default 'KES',
  max_redemptions int,
  redemptions_count int not null default 0,
  starts_at timestamptz,
  expires_at timestamptz,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT ON public.coupons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
-- Anyone (including anon) can read active, unexpired coupons to validate a code at checkout.
CREATE POLICY "coupons public read active" ON public.coupons FOR SELECT TO anon, authenticated
  USING (active = true AND (expires_at IS NULL OR expires_at > now()));
-- Only platform admins can insert/update/delete.
CREATE POLICY "coupons admin write" ON public.coupons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX coupons_code_active_idx ON public.coupons (code) WHERE active = true;
CREATE TRIGGER coupons_set_updated_at BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
