
ALTER TABLE public.mobility_vehicles
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.mobility_providers
  ADD COLUMN IF NOT EXISTS cover_image_url text;

ALTER TABLE public.mobility_bookings
  ADD COLUMN IF NOT EXISTS provider_response text,
  ADD COLUMN IF NOT EXISTS provider_responded_at timestamptz;

ALTER TABLE public.mobility_reviews
  ADD COLUMN IF NOT EXISTS response text,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_mobility_vehicles_active
  ON public.mobility_vehicles (status)
  WHERE is_archived = false;

-- RLS on the mobility-media bucket. Path convention is <org_id>/...
DROP POLICY IF EXISTS "mobility-media public read" ON storage.objects;
CREATE POLICY "mobility-media public read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'mobility-media');

DROP POLICY IF EXISTS "mobility-media org write" ON storage.objects;
CREATE POLICY "mobility-media org write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'mobility-media'
    AND public.is_org_member(auth.uid(), NULLIF(split_part(name, '/', 1), '')::uuid)
  );

DROP POLICY IF EXISTS "mobility-media org update" ON storage.objects;
CREATE POLICY "mobility-media org update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'mobility-media'
    AND public.is_org_member(auth.uid(), NULLIF(split_part(name, '/', 1), '')::uuid)
  );

DROP POLICY IF EXISTS "mobility-media org delete" ON storage.objects;
CREATE POLICY "mobility-media org delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'mobility-media'
    AND public.is_org_member(auth.uid(), NULLIF(split_part(name, '/', 1), '')::uuid)
  );
