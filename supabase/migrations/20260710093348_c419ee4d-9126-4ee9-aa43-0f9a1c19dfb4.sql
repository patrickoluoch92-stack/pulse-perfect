DROP POLICY IF EXISTS "Anyone can read active category nodes" ON public.property_category_nodes;

CREATE POLICY "Anyone can read active category nodes"
ON public.property_category_nodes
FOR SELECT
TO anon, authenticated
USING (active = true);