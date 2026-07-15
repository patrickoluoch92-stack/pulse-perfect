
ALTER TABLE public.mobility_providers
  ADD COLUMN IF NOT EXISTS commission_company_pct numeric NOT NULL DEFAULT 70.00,
  ADD COLUMN IF NOT EXISTS commission_platform_pct numeric NOT NULL DEFAULT 10.00,
  ADD COLUMN IF NOT EXISTS auto_approve_rules jsonb NOT NULL DEFAULT '{"enabled":false,"min_photos":4,"min_quality_score":75,"require_docs":["logbook","insurance"]}'::jsonb,
  ADD COLUMN IF NOT EXISTS payout_schedule text NOT NULL DEFAULT 'monthly';

ALTER TABLE public.mobility_providers DROP CONSTRAINT IF EXISTS mobility_providers_payout_schedule_check;
ALTER TABLE public.mobility_providers
  ADD CONSTRAINT mobility_providers_payout_schedule_check
  CHECK (payout_schedule IN ('weekly','biweekly','monthly'));

ALTER TABLE public.mobility_vehicles
  ADD COLUMN IF NOT EXISTS ai_recommendation jsonb;

CREATE OR REPLACE FUNCTION public.mobility_is_company_admin(_user_id uuid, _provider_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.mobility_providers p
    JOIN public.organization_members m ON m.org_id = p.org_id
    WHERE p.id = _provider_id
      AND m.user_id = _user_id
      AND m.role IN ('owner','enterprise_admin','admin','manager')
  );
$$;
REVOKE ALL ON FUNCTION public.mobility_is_company_admin(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mobility_is_company_admin(uuid, uuid) TO authenticated, service_role;

-- Public read on vehicles: require verified provider (status='approved') + approved-if-private submission
DROP POLICY IF EXISTS vehicles_public_read_approved ON public.mobility_vehicles;
CREATE POLICY vehicles_public_read_approved ON public.mobility_vehicles
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'approved'::mobility_status
    AND COALESCE(is_archived, false) = false
    AND EXISTS (
      SELECT 1 FROM public.mobility_providers p
      WHERE p.id = mobility_vehicles.provider_id
        AND p.verification_status = 'approved'::mobility_status
    )
    AND (
      owner_type = 'company'::mobility_owner_type
      OR submission_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.mobility_vehicle_submissions s
        WHERE s.id = mobility_vehicles.submission_id
          AND s.status = 'approved'
      )
    )
  );

-- Company PII: restrict column-level SELECT
REVOKE SELECT (tax_pin, business_reg_number, license_number) ON public.mobility_providers FROM anon;
REVOKE SELECT (tax_pin, business_reg_number, license_number) ON public.mobility_providers FROM authenticated;
GRANT SELECT (tax_pin, business_reg_number, license_number) ON public.mobility_providers TO service_role;
