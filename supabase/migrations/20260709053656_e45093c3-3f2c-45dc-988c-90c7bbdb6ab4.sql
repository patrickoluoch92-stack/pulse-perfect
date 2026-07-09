
CREATE OR REPLACE FUNCTION public.next_invoice_number(_org_id uuid, _user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE n BIGINT;
BEGIN
  IF _user_id IS NULL OR NOT public.is_org_member(_user_id, _org_id) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;
  INSERT INTO public.org_counters (org_id, invoice_seq) VALUES (_org_id, 1)
    ON CONFLICT (org_id) DO UPDATE SET invoice_seq = public.org_counters.invoice_seq + 1
  RETURNING invoice_seq INTO n;
  RETURN 'INV-' || lpad(n::text, 6, '0');
END; $$;

REVOKE EXECUTE ON FUNCTION public.next_invoice_number(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.next_invoice_number(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_invoice_number(uuid, uuid) TO service_role;
