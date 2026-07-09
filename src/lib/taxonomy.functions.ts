// Hierarchical property category taxonomy.
// Publicly readable (RLS + anon GRANT). Cached at request scope.

import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicSupabase() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export interface CategoryNode {
  id: string;
  slug: string;
  name: string;
  parent_id: string | null;
  legacy_category: string | null;
  description: string | null;
  icon: string | null;
  display_order: number;
  seo_title: string | null;
  seo_description: string | null;
  children?: CategoryNode[];
}

export const listCategoryTree = createServerFn({ method: "GET" }).handler(async () => {
  const s = publicSupabase();
  const { data, error } = await s
    .from("property_category_nodes" as any)
    .select("id, slug, name, parent_id, legacy_category, description, icon, display_order, seo_title, seo_description")
    .eq("active", true)
    .order("display_order");
  if (error) return { tree: [] as CategoryNode[], flat: [] as CategoryNode[] };

  const flat = (data ?? []) as unknown as CategoryNode[];
  const byParent = new Map<string | null, CategoryNode[]>();
  for (const n of flat) {
    const key = n.parent_id ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push({ ...n, children: [] });
  }
  const attach = (nodes: CategoryNode[]) => {
    for (const n of nodes) {
      n.children = byParent.get(n.id) ?? [];
      attach(n.children);
    }
  };
  const roots = byParent.get(null) ?? [];
  attach(roots);
  return { tree: roots, flat };
});

export const getCategoryBySlug = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => data as { slug: string })
  .handler(async ({ data }) => {
    const s = publicSupabase();
    const { data: node } = await s
      .from("property_category_nodes" as any)
      .select("id, slug, name, parent_id, legacy_category, description, icon, seo_title, seo_description")
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();
    if (!node) return null;
    const n = node as any;
    let parent: any = null;
    if (n.parent_id) {
      const { data: p } = await s
        .from("property_category_nodes" as any)
        .select("id, slug, name, seo_title, seo_description")
        .eq("id", n.parent_id)
        .maybeSingle();
      parent = p;
    }
    const { data: siblings } = await s
      .from("property_category_nodes" as any)
      .select("slug, name, display_order")
      .eq("parent_id", n.parent_id ?? n.id)
      .eq("active", true)
      .order("display_order");
    return { node: n, parent, siblings: siblings ?? [] };
  });
