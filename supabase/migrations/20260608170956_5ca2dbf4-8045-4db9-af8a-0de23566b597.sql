
CREATE TABLE public.ical_import_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  last_synced_at timestamptz,
  last_status text,
  last_error text,
  event_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ical_sources_unit ON public.ical_import_sources(unit_id);
CREATE INDEX idx_ical_sources_org ON public.ical_import_sources(org_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ical_import_sources TO authenticated;
GRANT ALL ON public.ical_import_sources TO service_role;
ALTER TABLE public.ical_import_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read ical sources" ON public.ical_import_sources
  FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "Managers insert ical sources" ON public.ical_import_sources
  FOR INSERT TO authenticated WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner'::org_role,'admin'::org_role,'manager'::org_role]));
CREATE POLICY "Managers update ical sources" ON public.ical_import_sources
  FOR UPDATE TO authenticated USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner'::org_role,'admin'::org_role,'manager'::org_role]))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner'::org_role,'admin'::org_role,'manager'::org_role]));
CREATE POLICY "Managers delete ical sources" ON public.ical_import_sources
  FOR DELETE TO authenticated USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner'::org_role,'admin'::org_role,'manager'::org_role]));

CREATE TRIGGER trg_ical_sources_updated_at BEFORE UPDATE ON public.ical_import_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.calendar_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.ical_import_sources(id) ON DELETE CASCADE,
  uid text NOT NULL,
  summary text,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_blocks_dates_check CHECK (ends_on > starts_on)
);
CREATE UNIQUE INDEX uniq_calendar_blocks_source_uid ON public.calendar_blocks(source_id, uid);
CREATE INDEX idx_calendar_blocks_unit_dates ON public.calendar_blocks(unit_id, starts_on, ends_on);
CREATE INDEX idx_calendar_blocks_org ON public.calendar_blocks(org_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_blocks TO authenticated;
GRANT ALL ON public.calendar_blocks TO service_role;
ALTER TABLE public.calendar_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read calendar blocks" ON public.calendar_blocks
  FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "Managers insert calendar blocks" ON public.calendar_blocks
  FOR INSERT TO authenticated WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner'::org_role,'admin'::org_role,'manager'::org_role]));
CREATE POLICY "Managers update calendar blocks" ON public.calendar_blocks
  FOR UPDATE TO authenticated USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner'::org_role,'admin'::org_role,'manager'::org_role]))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner'::org_role,'admin'::org_role,'manager'::org_role]));
CREATE POLICY "Managers delete calendar blocks" ON public.calendar_blocks
  FOR DELETE TO authenticated USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner'::org_role,'admin'::org_role,'manager'::org_role]));

CREATE TRIGGER trg_calendar_blocks_updated_at BEFORE UPDATE ON public.calendar_blocks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
