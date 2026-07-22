// Phase 2: subscription management on top of the existing M-Pesa checkout flow.
// The DB-backed `subscription_plans` table is the single source of truth for
// pricing and feature limits. Runtime checks resolve the caller's active plan
// from `subscriptions` (falling back to the org's `plan` column, then 'free').

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isPlatformAdmin, hasOrgRole } from "@/lib/access";

async function loadAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

// ---------- public plan catalog -------------------------------------------

export const listSubscriptionPlans = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client
    .from("subscription_plans")
    .select("*")
    .eq("active", true)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as any[] };
});

// ---------- subscription resolution for current org -----------------------

export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ orgId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const isMember = await hasOrgRole(context.supabase, context.userId, data.orgId, [
      "owner",
      "admin",
      "manager",
      "member",
    ]);
    if (!isMember && !(await isPlatformAdmin(context.supabase, context.userId)))
      throw new Error("Forbidden");

    const { data: sub } = await context.supabase
      .from("subscriptions")
      .select("*")
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: org } = await context.supabase
      .from("organizations")
      .select("plan")
      .eq("id", data.orgId)
      .maybeSingle();

    const activeCode =
      sub && (sub as any).status === "active" ? (sub as any).plan : ((org as any)?.plan ?? "free");

    const { data: planRow } = await context.supabase
      .from("subscription_plans")
      .select("*")
      .eq("code", activeCode)
      .maybeSingle();

    return { subscription: sub, plan: planRow, effectivePlanCode: activeCode };
  });

export const listBillingHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ orgId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const isMember = await hasOrgRole(context.supabase, context.userId, data.orgId, [
      "owner",
      "admin",
      "manager",
      "member",
    ]);
    if (!isMember && !(await isPlatformAdmin(context.supabase, context.userId)))
      throw new Error("Forbidden");

    const [{ data: subs }, { data: events }, { data: tx }] = await Promise.all([
      context.supabase
        .from("subscriptions")
        .select("*")
        .eq("org_id", data.orgId)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("subscription_events")
        .select("*")
        .eq("org_id", data.orgId)
        .order("created_at", { ascending: false })
        .limit(100),
      context.supabase
        .from("mpesa_transactions")
        .select(
          "id, status, amount, mpesa_receipt_number, subscription_id, invoice_id, created_at, transaction_date",
        )
        .eq("org_id", data.orgId)
        .not("subscription_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    return { subscriptions: subs ?? [], events: events ?? [], transactions: tx ?? [] };
  });

// ---------- lifecycle: cancel / resume -----------------------------------

export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        atPeriodEnd: z.boolean().default(true),
        reason: z.string().max(500).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const isOwner = await hasOrgRole(context.supabase, context.userId, data.orgId, [
      "owner",
      "admin",
    ]);
    if (!isOwner) throw new Error("Only owners can cancel a subscription");
    const admin = await loadAdmin();

    const { data: sub } = await admin
      .from("subscriptions")
      .select("*")
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub) throw new Error("No active subscription");
    const s = sub as any;
    if (["cancelled", "expired"].includes(s.status))
      throw new Error(`Cannot cancel in status ${s.status}`);

    if (data.atPeriodEnd) {
      await admin
        .from("subscriptions")
        .update({
          cancel_at_period_end: true,
          cancel_reason: data.reason ?? null,
        })
        .eq("id", s.id);
    } else {
      await admin
        .from("subscriptions")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancel_reason: data.reason ?? null,
        })
        .eq("id", s.id);
      await admin.from("organizations").update({ plan: "starter" }).eq("id", s.org_id);
    }

    await admin.from("subscription_events").insert({
      subscription_id: s.id,
      org_id: s.org_id,
      event_type: "cancelled",
      from_plan: s.plan,
      reason: data.reason ?? null,
      payload: { atPeriodEnd: data.atPeriodEnd },
      actor_user_id: context.userId,
    });
    return { ok: true };
  });

export const resumeSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ orgId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const isOwner = await hasOrgRole(context.supabase, context.userId, data.orgId, [
      "owner",
      "admin",
    ]);
    if (!isOwner) throw new Error("Only owners can resume a subscription");
    const admin = await loadAdmin();

    const { data: sub } = await admin
      .from("subscriptions")
      .select("*")
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub) throw new Error("No subscription to resume");
    const s = sub as any;
    if (!s.cancel_at_period_end) return { ok: true, noop: true };

    await admin
      .from("subscriptions")
      .update({
        cancel_at_period_end: false,
        cancel_reason: null,
      })
      .eq("id", s.id);
    await admin.from("subscription_events").insert({
      subscription_id: s.id,
      org_id: s.org_id,
      event_type: "resumed",
      to_plan: s.plan,
      actor_user_id: context.userId,
    });
    return { ok: true };
  });

// ---------- admin: plan CRUD ----------------------------------------------

async function assertAdmin(sb: any, userId: string) {
  if (!(await isPlatformAdmin(sb, userId))) throw new Error("Admin role required");
}

export const adminListAllPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("subscription_plans")
      .select("*")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

const planPayload = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(2).max(40),
  name: z.string().min(2).max(80),
  tagline: z.string().max(200).nullable().optional(),
  price_monthly_kes: z.number().int().min(0),
  price_yearly_kes: z.number().int().min(0),
  trial_days: z.number().int().min(0).max(365).default(0),
  property_limit: z.number().int().min(0).nullable().optional(),
  photo_limit_per_property: z.number().int().min(0).nullable().optional(),
  storage_mb: z.number().int().min(0).nullable().optional(),
  ai_calls_per_month: z.number().int().min(0).nullable().optional(),
  team_member_limit: z.number().int().min(0).nullable().optional(),
  has_api_access: z.boolean().default(false),
  has_priority_support: z.boolean().default(false),
  has_dynamic_pricing: z.boolean().default(false),
  has_channel_manager: z.boolean().default(false),
  has_promotional_boost: z.boolean().default(false),
  is_contact_sales: z.boolean().default(false),
  sort_order: z.number().int().min(0).max(1000).default(100),
  active: z.boolean().default(true),
});

export const adminUpsertPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => planPayload.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { id, ...rest } = data;
    if (id) {
      const { error } = await context.supabase.from("subscription_plans").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
      return { ok: true, id };
    }
    const { data: row, error } = await context.supabase
      .from("subscription_plans")
      .insert(rest)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const adminSetPlanActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("subscription_plans")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- feature limits helper ------------------------------------------

export const checkFeatureLimit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        feature: z.enum(["property", "photo_per_property", "team_member", "ai_calls"]),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { getPlanForOrg, currentUsage } = await import("@/lib/subscription.server");
    const plan = await getPlanForOrg(data.orgId);
    const usage = await currentUsage(data.orgId, data.feature);
    const limitKey = (
      {
        property: "property_limit",
        photo_per_property: "photo_limit_per_property",
        team_member: "team_member_limit",
        ai_calls: "ai_calls_per_month",
      } as const
    )[data.feature];
    const limit = plan?.[limitKey] ?? null;
    return {
      limit,
      usage,
      remaining: limit == null ? null : Math.max(0, limit - usage),
      planCode: plan?.code,
    };
  });
