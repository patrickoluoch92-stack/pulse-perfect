
-- =========================================================================
-- ENUMS
-- =========================================================================
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'manager', 'staff');
CREATE TYPE public.subscription_plan AS ENUM ('starter', 'professional', 'business', 'enterprise');
CREATE TYPE public.property_type AS ENUM ('hotel', 'lodge', 'resort', 'vacation_rental', 'airbnb', 'tour_operator');
CREATE TYPE public.unit_type AS ENUM ('room', 'suite', 'cabin', 'apartment', 'villa', 'tour_slot', 'other');
CREATE TYPE public.unit_status AS ENUM ('available', 'occupied', 'maintenance', 'cleaning', 'blocked');

-- =========================================================================
-- updated_at helper
-- =========================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- =========================================================================
-- ORGANIZATIONS
-- =========================================================================
CREATE TABLE public.organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  plan        public.subscription_plan NOT NULL DEFAULT 'starter',
  owner_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_organizations_owner ON public.organizations(owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- ORGANIZATION MEMBERS
-- =========================================================================
CREATE TABLE public.organization_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        public.org_role NOT NULL DEFAULT 'staff',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
CREATE INDEX idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX idx_org_members_org  ON public.organization_members(org_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- SECURITY DEFINER HELPERS (avoid RLS recursion)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND org_id = _org_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_user_id UUID, _org_id UUID, _roles public.org_role[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND org_id = _org_id AND role = ANY(_roles)
  );
$$;

-- =========================================================================
-- PROFILES
-- =========================================================================
CREATE TABLE public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT,
  avatar_url      TEXT,
  current_org_id  UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- =========================================================================
-- ORGANIZATIONS RLS POLICIES
-- =========================================================================
CREATE POLICY "Members read their organizations" ON public.organizations
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), id));

CREATE POLICY "Authenticated users can create an organization" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners and admins update their organization" ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), id, ARRAY['owner','admin']::public.org_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), id, ARRAY['owner','admin']::public.org_role[]));

CREATE POLICY "Owners delete their organization" ON public.organizations
  FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), id, ARRAY['owner']::public.org_role[]));

-- =========================================================================
-- ORGANIZATION MEMBERS RLS POLICIES
-- =========================================================================
CREATE POLICY "Members read membership of their organizations" ON public.organization_members
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

-- Allow a user to insert themselves as the first member (bootstrap),
-- AND allow owners/admins to add others.
CREATE POLICY "Self-insert or admin add member" ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[])
  );

CREATE POLICY "Owners and admins update members" ON public.organization_members
  FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));

CREATE POLICY "Owners and admins remove members" ON public.organization_members
  FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));

-- =========================================================================
-- PROPERTIES
-- =========================================================================
CREATE TABLE public.properties (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        public.property_type NOT NULL DEFAULT 'hotel',
  description TEXT,
  address     TEXT,
  city        TEXT,
  country     TEXT,
  timezone    TEXT NOT NULL DEFAULT 'UTC',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_properties_org ON public.properties(org_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_properties_updated_at
BEFORE UPDATE ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Members read properties" ON public.properties
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Managers create properties" ON public.properties
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','manager']::public.org_role[]));

CREATE POLICY "Managers update properties" ON public.properties
  FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','manager']::public.org_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','manager']::public.org_role[]));

CREATE POLICY "Admins delete properties" ON public.properties
  FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));

-- =========================================================================
-- UNITS
-- =========================================================================
CREATE TABLE public.units (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  type         public.unit_type NOT NULL DEFAULT 'room',
  capacity     INTEGER NOT NULL DEFAULT 2 CHECK (capacity >= 0),
  base_price   NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (base_price >= 0),
  status       public.unit_status NOT NULL DEFAULT 'available',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_units_property ON public.units(property_id);
CREATE INDEX idx_units_org      ON public.units(org_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.units TO authenticated;
GRANT ALL ON public.units TO service_role;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_units_updated_at
BEFORE UPDATE ON public.units
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Members read units" ON public.units
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Managers create units" ON public.units
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','manager']::public.org_role[]));

CREATE POLICY "Managers update units" ON public.units
  FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','manager']::public.org_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','manager']::public.org_role[]));

CREATE POLICY "Admins delete units" ON public.units
  FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));

-- =========================================================================
-- NEW USER BOOTSTRAP — creates profile + personal org + owner membership
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_org_id UUID;
  display_name TEXT;
  base_slug TEXT;
  final_slug TEXT;
  suffix INT := 0;
BEGIN
  display_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    split_part(NEW.email, '@', 1)
  );

  base_slug := regexp_replace(lower(coalesce(display_name, 'workspace')), '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  IF base_slug = '' THEN base_slug := 'workspace'; END IF;
  final_slug := base_slug;

  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = final_slug) LOOP
    suffix := suffix + 1;
    final_slug := base_slug || '-' || suffix::text;
  END LOOP;

  INSERT INTO public.organizations (name, slug, owner_id)
  VALUES (display_name || '''s workspace', final_slug, NEW.id)
  RETURNING id INTO new_org_id;

  INSERT INTO public.organization_members (org_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'owner');

  INSERT INTO public.profiles (id, full_name, current_org_id, avatar_url)
  VALUES (NEW.id, display_name, new_org_id, NEW.raw_user_meta_data ->> 'avatar_url');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
