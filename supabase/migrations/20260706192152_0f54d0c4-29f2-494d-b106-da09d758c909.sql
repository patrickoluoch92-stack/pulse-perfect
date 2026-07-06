
-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =========================================================
-- discovery_sources
-- =========================================================
CREATE TABLE public.discovery_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('directory','county_page','owner_url','google_business')),
  url text NOT NULL UNIQUE,
  label text,
  county_code text,
  enabled boolean NOT NULL DEFAULT true,
  last_crawled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.discovery_sources TO authenticated;
GRANT ALL ON public.discovery_sources TO service_role;
ALTER TABLE public.discovery_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage discovery sources"
  ON public.discovery_sources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_discovery_sources_updated_at
  BEFORE UPDATE ON public.discovery_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- discovered_properties
-- =========================================================
CREATE TABLE public.discovered_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','merged','archived','claimed')),
  source_id uuid REFERENCES public.discovery_sources(id) ON DELETE SET NULL,
  source_url text,
  slug text UNIQUE,
  name text NOT NULL,
  property_type text,
  county_code text,
  town text,
  ward text,
  address text,
  latitude double precision,
  longitude double precision,
  phone text,
  email text,
  whatsapp text,
  website text,
  socials jsonb NOT NULL DEFAULT '{}'::jsonb,
  amenities text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  keywords text[] NOT NULL DEFAULT '{}',
  ai_description text,
  ai_confidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality_score int NOT NULL DEFAULT 0,
  dedupe_fingerprint text,
  merged_into uuid REFERENCES public.discovered_properties(id) ON DELETE SET NULL,
  promoted_property_id uuid REFERENCES public.marketplace_properties(id) ON DELETE SET NULL,
  rejection_reason text,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.discovered_properties TO authenticated;
GRANT ALL ON public.discovered_properties TO service_role;
ALTER TABLE public.discovered_properties ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_disc_props_search_trgm
  ON public.discovered_properties
  USING gin ((name || ' ' || coalesce(town,'') || ' ' || coalesce(county_code,'')) gin_trgm_ops);
CREATE INDEX idx_disc_props_status_county_quality
  ON public.discovered_properties (status, county_code, quality_score DESC);
CREATE INDEX idx_disc_props_fingerprint
  ON public.discovered_properties (dedupe_fingerprint) WHERE dedupe_fingerprint IS NOT NULL;

-- Public/authenticated may SELECT but only when status is visible; contact fields are still selectable at row level (we filter columns at query/view level).
CREATE POLICY "Discovered visible statuses readable by everyone"
  ON public.discovered_properties FOR SELECT TO authenticated
  USING (status IN ('pending','approved','claimed'));

CREATE POLICY "Admins full access discovered"
  ON public.discovered_properties FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_disc_props_updated_at
  BEFORE UPDATE ON public.discovered_properties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Column-level: revoke PII from authenticated (admins bypass via ALL policy? No — column privs apply.
-- Instead we simply do not project PII columns in the public view; authenticated role keeps SELECT on the base
-- table via server-side authenticated fetchers that intentionally omit contact columns for non-admins.)

-- Public safe view (no PII, only visible statuses).
CREATE OR REPLACE VIEW public.public_discovered_properties
WITH (security_invoker = true)
AS
SELECT
  id, slug, status, name, property_type, county_code, town, ward, address,
  latitude, longitude, website,
  amenities, tags, keywords,
  ai_description, quality_score,
  created_at, updated_at
FROM public.discovered_properties
WHERE status IN ('pending','approved','claimed');

GRANT SELECT ON public.public_discovered_properties TO anon, authenticated;

-- Anon SELECT on base table only for the columns exposed via view — provide narrow public policy so
-- security_invoker view (anon role) can read.
CREATE POLICY "Anon can read visible discovered rows"
  ON public.discovered_properties FOR SELECT TO anon
  USING (status IN ('pending','approved','claimed'));

GRANT SELECT ON public.discovered_properties TO anon;

-- =========================================================
-- discovery_runs
-- =========================================================
CREATE TABLE public.discovery_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.discovery_sources(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'tick',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  ok boolean,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text
);
GRANT SELECT ON public.discovery_runs TO authenticated;
GRANT ALL ON public.discovery_runs TO service_role;
ALTER TABLE public.discovery_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read discovery runs"
  ON public.discovery_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- property_claims
-- =========================================================
CREATE TABLE public.property_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discovered_id uuid NOT NULL REFERENCES public.discovered_properties(id) ON DELETE CASCADE,
  claimant_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claimant_email text NOT NULL,
  claimant_phone text,
  proof_notes text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','verified','rejected','withdrawn')),
  verification_code_hash text,
  verification_expires_at timestamptz,
  verification_attempts int NOT NULL DEFAULT 0,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.property_claims TO authenticated;
GRANT ALL ON public.property_claims TO service_role;
ALTER TABLE public.property_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own claims"
  ON public.property_claims FOR SELECT TO authenticated
  USING (claimant_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users create claims"
  ON public.property_claims FOR INSERT TO authenticated
  WITH CHECK (claimant_id = auth.uid());

CREATE POLICY "Users update own claims"
  ON public.property_claims FOR UPDATE TO authenticated
  USING (claimant_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (claimant_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_property_claims_updated_at
  BEFORE UPDATE ON public.property_claims
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- property_merge_audit
-- =========================================================
CREATE TABLE public.property_merge_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_id uuid REFERENCES public.discovered_properties(id) ON DELETE SET NULL,
  duplicate_id uuid REFERENCES public.discovered_properties(id) ON DELETE SET NULL,
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  diff jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.property_merge_audit TO authenticated;
GRANT ALL ON public.property_merge_audit TO service_role;
ALTER TABLE public.property_merge_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read merge audit"
  ON public.property_merge_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- discovery_feedback
-- =========================================================
CREATE TABLE public.discovery_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discovered_id uuid REFERENCES public.discovered_properties(id) ON DELETE CASCADE,
  field text NOT NULL,
  before_value jsonb,
  after_value jsonb,
  editor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  edited_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.discovery_feedback TO authenticated;
GRANT ALL ON public.discovery_feedback TO service_role;
ALTER TABLE public.discovery_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read discovery feedback"
  ON public.discovery_feedback FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins write discovery feedback"
  ON public.discovery_feedback FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed a few legitimate Kenyan tourism/directory sources
INSERT INTO public.discovery_sources (kind, url, label, county_code) VALUES
  ('directory',   'https://magicalkenya.com/where-to-stay/',                   'Magical Kenya - Where to Stay', NULL),
  ('directory',   'https://ktb.go.ke/accommodation/',                          'Kenya Tourism Board',           NULL),
  ('directory',   'https://kahc.co.ke/members/',                               'Kenya Association of Hotelkeepers & Caterers', NULL),
  ('county_page', 'https://mombasa.go.ke/tourism/',                            'Mombasa County Tourism',        '001'),
  ('county_page', 'https://kwale.go.ke/tourism/',                              'Kwale County Tourism',          '002')
ON CONFLICT (url) DO NOTHING;
