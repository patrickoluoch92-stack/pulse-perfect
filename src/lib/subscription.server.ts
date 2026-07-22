// Server-only helpers for subscription plan resolution and usage metering.
// Loaded lazily from server functions and route handlers.

import { createClient } from "@supabase/supabase-js";

let _admin: ReturnType<typeof createClient> | null = null;
function admin() {
  if (!_admin) {
    _admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}

export interface PlanRow {
  code: string;
  name: string;
  property_limit: number | null;
  photo_limit_per_property: number | null;
  storage_mb: number | null;
  ai_calls_per_month: number | null;
  team_member_limit: number | null;
  has_api_access: boolean;
  has_priority_support: boolean;
  has_dynamic_pricing: boolean;
  has_channel_manager: boolean;
  has_promotional_boost: boolean;
  [k: string]: any;
}

export async function getPlanForOrg(orgId: string): Promise<PlanRow | null> {
  const a = admin();
  const { data: sub } = await a
    .from("subscriptions")
    .select("plan, status, current_period_end")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let code: string | null = null;
  const s = sub as any;
  if (s && s.status === "active") code = s.plan;

  if (!code) {
    const { data: org } = await a
      .from("organizations")
      .select("plan")
      .eq("id", orgId)
      .maybeSingle();
    code = (org as any)?.plan ?? "free";
  }
  const { data: plan } = await a
    .from("subscription_plans")
    .select("*")
    .eq("code", code!)
    .maybeSingle();
  return (plan as any) ?? null;
}

export type UsageFeature = "property" | "photo_per_property" | "team_member" | "ai_calls";

export async function currentUsage(orgId: string, feature: UsageFeature): Promise<number> {
  const a = admin();
  switch (feature) {
    case "property": {
      const { count } = await a
        .from("marketplace_properties")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId);
      return count ?? 0;
    }
    case "team_member": {
      const { count } = await a
        .from("organization_members")
        .select("user_id", { count: "exact", head: true })
        .eq("org_id", orgId);
      return count ?? 0;
    }
    case "ai_calls": {
      const since = new Date();
      since.setUTCDate(1);
      since.setUTCHours(0, 0, 0, 0);
      const { count } = await a
        .from("knowledge_search_events")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .gte("created_at", since.toISOString());
      return count ?? 0;
    }
    case "photo_per_property":
      return 0; // enforced per-property in upload path
  }
}

export async function assertPropertyLimit(orgId: string): Promise<void> {
  const plan = await getPlanForOrg(orgId);
  if (!plan || plan.property_limit == null) return;
  const used = await currentUsage(orgId, "property");
  if (used >= plan.property_limit) {
    throw new Error(
      `Plan ${plan.name} allows up to ${plan.property_limit} listings. Upgrade to add more.`,
    );
  }
}
