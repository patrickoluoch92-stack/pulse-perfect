import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getWorkspaceContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, current_org_id")
      .eq("id", userId)
      .maybeSingle();

    const { data: memberships } = await supabase
      .from("organization_members")
      .select("role, org_id, organizations(id, name, slug, plan)")
      .eq("user_id", userId);

    const orgs = (memberships ?? [])
      .map((m) => m.organizations && { ...m.organizations, role: m.role })
      .filter(Boolean) as Array<{
        id: string; name: string; slug: string; plan: string; role: string;
      }>;

    const currentOrg =
      orgs.find((o) => o.id === profile?.current_org_id) ?? orgs[0] ?? null;

    return { profile, organizations: orgs, currentOrg };
  });

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId: string }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const [properties, units] = await Promise.all([
      supabase.from("properties").select("id", { count: "exact", head: true }).eq("org_id", data.orgId),
      supabase.from("units").select("id, status", { count: "exact" }).eq("org_id", data.orgId),
    ]);

    const allUnits = units.data ?? [];
    return {
      propertyCount: properties.count ?? 0,
      unitCount: units.count ?? 0,
      occupied: allUnits.filter((u) => u.status === "occupied").length,
      available: allUnits.filter((u) => u.status === "available").length,
    };
  });

export const listProperties = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId: string }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: props, error } = await supabase
      .from("properties")
      .select("id, name, type, city, country, created_at")
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return props ?? [];
  });
