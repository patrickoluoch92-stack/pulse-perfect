
-- 1) commission_rules: only admins may read
DROP POLICY IF EXISTS "commission_rules authenticated read" ON public.commission_rules;
CREATE POLICY "commission_rules admin read"
  ON public.commission_rules
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 2) review_ai_analysis: only expose when parent review's property is approved
DROP POLICY IF EXISTS "Public read review AI analysis" ON public.review_ai_analysis;
CREATE POLICY "Public read review AI analysis for approved listings"
  ON public.review_ai_analysis
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.marketplace_property_reviews r
      JOIN public.marketplace_properties p ON p.id = r.property_id
      WHERE r.id = review_ai_analysis.review_id
        AND p.status = 'approved'::mkt_listing_status
    )
  );

-- 3) Storage: scope public read of marketplace-properties bucket to files
-- referenced by approved listings. Org members can still read their own,
-- and admins have full access via the existing admin policy.
DROP POLICY IF EXISTS "Marketplace images are publicly readable" ON storage.objects;

CREATE POLICY "Marketplace images public read approved only"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'marketplace-properties'
    AND (
      EXISTS (
        SELECT 1
        FROM public.marketplace_property_images i
        JOIN public.marketplace_properties p ON p.id = i.property_id
        WHERE i.storage_path = storage.objects.name
          AND p.status = 'approved'::mkt_listing_status
      )
      OR EXISTS (
        SELECT 1
        FROM public.marketplace_properties p
        WHERE p.main_image_path = storage.objects.name
          AND p.status = 'approved'::mkt_listing_status
      )
    )
  );

CREATE POLICY "Marketplace images org members read own"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'marketplace-properties'
    AND (
      EXISTS (
        SELECT 1
        FROM public.marketplace_property_images i
        JOIN public.marketplace_properties p ON p.id = i.property_id
        WHERE i.storage_path = storage.objects.name
          AND public.is_org_member(auth.uid(), p.org_id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.marketplace_properties p
        WHERE p.main_image_path = storage.objects.name
          AND public.is_org_member(auth.uid(), p.org_id)
      )
    )
  );
