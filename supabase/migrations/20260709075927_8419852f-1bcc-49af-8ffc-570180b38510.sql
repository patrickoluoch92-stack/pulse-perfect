
REVOKE SELECT (contact_email, contact_phone, contact_whatsapp) ON public.marketplace_properties FROM anon, authenticated, PUBLIC;
GRANT SELECT (contact_email, contact_phone, contact_whatsapp) ON public.marketplace_properties TO service_role;

REVOKE SELECT (email, phone, whatsapp) ON public.discovered_properties FROM anon, authenticated, PUBLIC;
GRANT SELECT (email, phone, whatsapp) ON public.discovered_properties TO service_role;

REVOKE SELECT (raw) ON public.external_listings FROM anon, authenticated, PUBLIC;
GRANT SELECT (raw) ON public.external_listings TO service_role;

DROP POLICY IF EXISTS knowledge_facts_org_write ON public.knowledge_property_facts;
CREATE POLICY knowledge_facts_org_write
  ON public.knowledge_property_facts
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id IS NOT NULL AND public.is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS knowledge_facts_org_update ON public.knowledge_property_facts;
CREATE POLICY knowledge_facts_org_update
  ON public.knowledge_property_facts
  FOR UPDATE
  TO authenticated
  USING (org_id IS NOT NULL AND public.is_org_member(auth.uid(), org_id))
  WITH CHECK (org_id IS NOT NULL AND public.is_org_member(auth.uid(), org_id));
