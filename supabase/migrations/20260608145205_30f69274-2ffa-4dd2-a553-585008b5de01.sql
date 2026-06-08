
-- ============ INVITATIONS ============
CREATE TABLE public.organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.org_role NOT NULL DEFAULT 'staff',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, email)
);
CREATE INDEX idx_invitations_org ON public.organization_invitations(org_id);
CREATE INDEX idx_invitations_token ON public.organization_invitations(token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_invitations TO authenticated;
GRANT ALL ON public.organization_invitations TO service_role;

ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage invitations"
  ON public.organization_invitations FOR ALL TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));

CREATE POLICY "Members view invitations"
  ON public.organization_invitations FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

CREATE TRIGGER trg_invitations_updated BEFORE UPDATE ON public.organization_invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Allow owners/admins to update member roles & remove (already via existing policies? add explicit)
DROP POLICY IF EXISTS "Org admins manage members" ON public.organization_members;
CREATE POLICY "Org admins manage members"
  ON public.organization_members FOR ALL TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[]));

-- Accept invitation RPC: validates token, adds membership, marks invite accepted.
CREATE OR REPLACE FUNCTION public.accept_organization_invitation(_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.organization_invitations%ROWTYPE;
  uid UUID := auth.uid();
  user_email TEXT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO user_email FROM auth.users WHERE id = uid;

  SELECT * INTO inv FROM public.organization_invitations WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF inv.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'Invitation already accepted'; END IF;
  IF inv.expires_at < now() THEN RAISE EXCEPTION 'Invitation expired'; END IF;
  IF lower(inv.email) <> lower(user_email) THEN
    RAISE EXCEPTION 'This invitation was sent to a different email';
  END IF;

  INSERT INTO public.organization_members (org_id, user_id, role)
  VALUES (inv.org_id, uid, inv.role)
  ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  UPDATE public.organization_invitations
    SET accepted_at = now(), accepted_by = uid
    WHERE id = inv.id;

  RETURN inv.org_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.accept_organization_invitation(TEXT) TO authenticated;

-- Lookup invitation by token (for accept screen)
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(_token TEXT)
RETURNS TABLE(org_id UUID, org_name TEXT, email TEXT, role public.org_role, expires_at TIMESTAMPTZ, accepted_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT i.org_id, o.name, i.email, i.role, i.expires_at, i.accepted_at
  FROM public.organization_invitations i
  JOIN public.organizations o ON o.id = i.org_id
  WHERE i.token = _token;
$$;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(TEXT) TO authenticated, anon;

-- ============ GUESTS ============
CREATE TABLE public.guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  country TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_guests_org ON public.guests(org_id);
CREATE INDEX idx_guests_email ON public.guests(org_id, lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guests TO authenticated;
GRANT ALL ON public.guests TO service_role;

ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read guests" ON public.guests FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "Members insert guests" ON public.guests FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "Members update guests" ON public.guests FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), org_id))
  WITH CHECK (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "Managers delete guests" ON public.guests FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','manager']::public.org_role[]));

CREATE TRIGGER trg_guests_updated BEFORE UPDATE ON public.guests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ RESERVATIONS ============
CREATE TYPE public.reservation_status AS ENUM (
  'pending','confirmed','checked_in','checked_out','cancelled','no_show'
);

CREATE TYPE public.reservation_source AS ENUM (
  'direct','airbnb','booking_com','vrbo','expedia','other'
);

CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES public.guests(id) ON DELETE RESTRICT,
  status public.reservation_status NOT NULL DEFAULT 'confirmed',
  source public.reservation_source NOT NULL DEFAULT 'direct',
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  adults INT NOT NULL DEFAULT 1 CHECK (adults >= 0),
  children INT NOT NULL DEFAULT 0 CHECK (children >= 0),
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  confirmation_code TEXT NOT NULL UNIQUE DEFAULT upper(substring(encode(gen_random_bytes(6),'hex') from 1 for 8)),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (check_out > check_in)
);
CREATE INDEX idx_reservations_org ON public.reservations(org_id);
CREATE INDEX idx_reservations_unit_dates ON public.reservations(unit_id, check_in, check_out);
CREATE INDEX idx_reservations_property ON public.reservations(property_id);
CREATE INDEX idx_reservations_guest ON public.reservations(guest_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO authenticated;
GRANT ALL ON public.reservations TO service_role;

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read reservations" ON public.reservations FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "Members insert reservations" ON public.reservations FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "Members update reservations" ON public.reservations FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), org_id))
  WITH CHECK (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "Managers delete reservations" ON public.reservations FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin','manager']::public.org_role[]));

CREATE TRIGGER trg_reservations_updated BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Prevent overlapping active reservations per unit (use GIST exclusion)
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_no_overlap
  EXCLUDE USING GIST (
    unit_id WITH =,
    daterange(check_in, check_out, '[)') WITH &&
  ) WHERE (status NOT IN ('cancelled','no_show'));
