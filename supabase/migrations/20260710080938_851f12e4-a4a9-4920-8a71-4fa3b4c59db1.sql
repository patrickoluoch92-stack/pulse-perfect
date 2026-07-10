
-- Fix: PostgREST needs table-level GRANTs for anon/authenticated to read category taxonomy
GRANT SELECT ON public.property_category_nodes TO anon, authenticated;
GRANT ALL ON public.property_category_nodes TO service_role;

-- Seed missing commercial categories under Commercial / Rental Houses
DO $$
DECLARE
  parent UUID;
  base_order INT;
BEGIN
  SELECT id INTO parent FROM public.property_category_nodes WHERE slug = 'commercial-rental-houses';
  IF parent IS NULL THEN RETURN; END IF;
  SELECT COALESCE(MAX(display_order), 0) INTO base_order FROM public.property_category_nodes WHERE parent_id = parent;

  INSERT INTO public.property_category_nodes (slug, name, parent_id, display_order, active, description)
  VALUES
    ('shop', 'Shop', parent, base_order + 1, true, 'Shop spaces for rent across Kenya.'),
    ('retail-space', 'Retail Space', parent, base_order + 2, true, 'Retail spaces for rent across Kenya.'),
    ('warehouse', 'Warehouse', parent, base_order + 3, true, 'Warehouse spaces for rent across Kenya.'),
    ('godown', 'Godown', parent, base_order + 4, true, 'Godown spaces for rent across Kenya.'),
    ('business-premises', 'Business Premises', parent, base_order + 5, true, 'Business premises for rent across Kenya.'),
    ('co-working-space', 'Co-working Space', parent, base_order + 6, true, 'Co-working spaces for rent across Kenya.'),
    ('commercial-building', 'Commercial Building', parent, base_order + 7, true, 'Commercial buildings for rent across Kenya.'),
    ('mixed-use-property', 'Mixed-use Property', parent, base_order + 8, true, 'Mixed-use properties for rent across Kenya.')
  ON CONFLICT (slug) DO NOTHING;
END $$;
