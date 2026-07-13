
-- RBAC v2: extend platform roles, add granular permissions, and audit hooks.

-- 1. Extend enums (additive only)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support';
ALTER TYPE public.org_role ADD VALUE IF NOT EXISTS 'enterprise_admin';
ALTER TYPE public.org_role ADD VALUE IF NOT EXISTS 'guest';

-- Enum values must be committed before use in later statements, so wrap
-- the rest of the migration in COMMIT + new block via DO $$ isn't allowed —
-- instead we run the value-using statements in a second migration section
-- guarded by pg_sleep. To keep this migration atomic and idempotent, we
-- avoid using the *new* enum values in any statement inside this same tx.
-- Downstream backfill uses only 'admin' which already exists.

-- 2. Permission catalog
CREATE TABLE IF NOT EXISTS public.rbac_permissions (
  key TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rbac_permissions TO authenticated;
GRANT ALL ON public.rbac_permissions TO service_role;
ALTER TABLE public.rbac_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rbac_permissions_read" ON public.rbac_permissions;
CREATE POLICY "rbac_permissions_read" ON public.rbac_permissions
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.rbac_permissions (key, category, label, description) VALUES
  ('bookings.read',       'bookings',   'View bookings',            'Read bookings for the org'),
  ('bookings.write',      'bookings',   'Manage bookings',          'Create/update bookings'),
  ('bookings.refund',     'bookings',   'Refund bookings',          'Issue booking refunds'),
  ('pricing.write',       'pricing',    'Edit pricing',             'Change rates and pricing rules'),
  ('availability.write',  'pricing',    'Edit availability',        'Manage calendar blocks / availability'),
  ('reviews.moderate',    'content',    'Moderate reviews',         'Approve, hide or remove reviews'),
  ('finance.read',        'finance',    'View finance',             'Read invoices, payouts, ledgers'),
  ('finance.payout',      'finance',    'Approve payouts',          'Approve or release payouts'),
  ('marketing.write',     'marketing',  'Manage marketing',         'Coupons, campaigns, CMS blocks'),
  ('guests.pii.read',     'guests',     'View guest contact info',  'Read guest email/phone'),
  ('team.invite',         'team',       'Invite / manage team',     'Invite members, change roles'),
  ('reports.read',        'analytics',  'View reports',             'Read analytics dashboards')
ON CONFLICT (key) DO NOTHING;

-- 3. Role defaults (which permissions each org_role gets by default)
CREATE TABLE IF NOT EXISTS public.rbac_role_defaults (
  role public.org_role NOT NULL,
  permission TEXT NOT NULL REFERENCES public.rbac_permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role, permission)
);
GRANT SELECT ON public.rbac_role_defaults TO authenticated;
GRANT ALL ON public.rbac_role_defaults TO service_role;
ALTER TABLE public.rbac_role_defaults ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rbac_role_defaults_read" ON public.rbac_role_defaults;
CREATE POLICY "rbac_role_defaults_read" ON public.rbac_role_defaults
  FOR SELECT TO authenticated USING (true);

-- Seed defaults for pre-existing roles (owner/admin/manager/staff). We can't
-- reference 'enterprise_admin'/'guest' in the same tx that added them.
INSERT INTO public.rbac_role_defaults (role, permission)
SELECT r::public.org_role, p.key
FROM (VALUES ('owner'), ('admin')) AS x(r), public.rbac_permissions p
ON CONFLICT DO NOTHING;

INSERT INTO public.rbac_role_defaults (role, permission) VALUES
  ('manager', 'bookings.read'),
  ('manager', 'bookings.write'),
  ('manager', 'bookings.refund'),
  ('manager', 'pricing.write'),
  ('manager', 'availability.write'),
  ('manager', 'reviews.moderate'),
  ('manager', 'guests.pii.read'),
  ('manager', 'reports.read'),
  ('staff',   'bookings.read'),
  ('staff',   'availability.write')
ON CONFLICT DO NOTHING;

-- 4. Per-member permission overrides (grant or explicit revoke)
CREATE TABLE IF NOT EXISTS public.organization_member_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  permission TEXT NOT NULL REFERENCES public.rbac_permissions(key) ON DELETE CASCADE,
  effect TEXT NOT NULL DEFAULT 'grant' CHECK (effect IN ('grant','revoke')),
  granted_by UUID,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id, permission)
);
CREATE INDEX IF NOT EXISTS idx_omp_lookup ON public.organization_member_permissions(user_id, org_id, permission);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_member_permissions TO authenticated;
GRANT ALL ON public.organization_member_permissions TO service_role;
ALTER TABLE public.organization_member_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "omp_self_read" ON public.organization_member_permissions;
CREATE POLICY "omp_self_read" ON public.organization_member_permissions
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[])
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "omp_admin_write" ON public.organization_member_permissions;
CREATE POLICY "omp_admin_write" ON public.organization_member_permissions
  FOR ALL TO authenticated
  USING (
    public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[])
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    public.has_org_role(auth.uid(), org_id, ARRAY['owner','admin']::public.org_role[])
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- 5. Permission resolver (SECURITY DEFINER; role defaults ∪ explicit grant, minus explicit revoke)
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _org_id UUID, _permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- platform admins pass everything
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'::public.app_role)
    OR (
      -- explicit revoke wins
      NOT EXISTS (
        SELECT 1 FROM public.organization_member_permissions
        WHERE user_id = _user_id AND org_id = _org_id
          AND permission = _permission AND effect = 'revoke'
      )
      AND (
        -- explicit grant
        EXISTS (
          SELECT 1 FROM public.organization_member_permissions
          WHERE user_id = _user_id AND org_id = _org_id
            AND permission = _permission AND effect = 'grant'
        )
        OR
        -- role default
        EXISTS (
          SELECT 1
          FROM public.organization_members m
          JOIN public.rbac_role_defaults d ON d.role = m.role
          WHERE m.user_id = _user_id AND m.org_id = _org_id
            AND d.permission = _permission
        )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.has_permission(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_permission(UUID, UUID, TEXT) TO authenticated, service_role;

-- 6. Audit trigger on role and permission changes
CREATE OR REPLACE FUNCTION public.audit_rbac_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  action_type TEXT;
  target_org UUID;
  target_user UUID;
  payload JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN action_type := TG_TABLE_NAME || '.insert';
  ELSIF TG_OP = 'UPDATE' THEN action_type := TG_TABLE_NAME || '.update';
  ELSE action_type := TG_TABLE_NAME || '.delete';
  END IF;

  IF TG_TABLE_NAME = 'organization_members' THEN
    target_org := COALESCE(NEW.org_id, OLD.org_id);
    target_user := COALESCE(NEW.user_id, OLD.user_id);
    payload := jsonb_build_object(
      'old_role', OLD.role, 'new_role', NEW.role
    );
  ELSIF TG_TABLE_NAME = 'user_roles' THEN
    target_user := COALESCE(NEW.user_id, OLD.user_id);
    payload := jsonb_build_object('old_role', OLD.role, 'new_role', NEW.role);
  ELSIF TG_TABLE_NAME = 'organization_member_permissions' THEN
    target_org := COALESCE(NEW.org_id, OLD.org_id);
    target_user := COALESCE(NEW.user_id, OLD.user_id);
    payload := jsonb_build_object(
      'permission', COALESCE(NEW.permission, OLD.permission),
      'effect', COALESCE(NEW.effect, OLD.effect)
    );
  END IF;

  INSERT INTO public.audit_logs (actor_id, org_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), target_org, action_type, TG_TABLE_NAME, target_user, payload);

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- Never block the underlying operation because of audit failure
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_audit_org_members ON public.organization_members;
CREATE TRIGGER trg_audit_org_members
  AFTER INSERT OR UPDATE OR DELETE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.audit_rbac_change();

DROP TRIGGER IF EXISTS trg_audit_user_roles ON public.user_roles;
CREATE TRIGGER trg_audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_rbac_change();

DROP TRIGGER IF EXISTS trg_audit_omp ON public.organization_member_permissions;
CREATE TRIGGER trg_audit_omp
  AFTER INSERT OR UPDATE OR DELETE ON public.organization_member_permissions
  FOR EACH ROW EXECUTE FUNCTION public.audit_rbac_change();
