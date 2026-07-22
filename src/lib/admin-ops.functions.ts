// Admin-only aggregation for Fraud & Compliance, CMS, and DevOps modules.
// All fns gate on isPlatformAdmin, then use supabaseAdmin for cross-org reads.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isPlatformAdmin } from "@/lib/access";

async function requireAdmin(context: any) {
  const admin = await isPlatformAdmin(context.supabase, context.userId);
  if (!admin) throw new Error("Forbidden: platform admin required");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function startOfDayUTC(d = new Date()) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * 86400000);
}

// -----------------------------------------------------------------------------
// Fraud & Compliance
// -----------------------------------------------------------------------------

export const adminFraudOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await requireAdmin(context);
    const now = new Date();
    const today = startOfDayUTC(now);
    const weekAgo = addDays(today, -6);

    const [bookings, rateEvents, audit, claims, mpesa] = await Promise.all([
      s
        .from("marketplace_bookings")
        .select("id, status, total_amount, created_at, guest_id, property_id")
        .order("created_at", { ascending: false })
        .limit(500),
      s
        .from("rate_limit_events")
        .select("bucket, user_id, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      s
        .from("audit_logs")
        .select("id, action, actor_id, created_at, metadata")
        .order("created_at", { ascending: false })
        .limit(100),
      s
        .from("property_claims")
        .select("id, status, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      s
        .from("mpesa_transactions")
        .select("id, status, amount, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const bList = (bookings.data ?? []) as any[];
    const cancelRate = (() => {
      const wk = bList.filter((b) => new Date(b.created_at) >= weekAgo);
      if (wk.length === 0) return 0;
      return Math.round((wk.filter((b) => b.status === "cancelled").length / wk.length) * 100);
    })();

    // Simple heuristic: multiple bookings by same guest same day
    const dupMap = new Map<string, number>();
    for (const b of bList) {
      const k = `${b.guest_id}|${b.created_at?.slice(0, 10)}`;
      dupMap.set(k, (dupMap.get(k) ?? 0) + 1);
    }
    const dupGuests = Array.from(dupMap.entries()).filter(([, n]) => n >= 3).length;

    const rateList = (rateEvents.data ?? []) as any[];
    const throttledUsers = new Set(rateList.map((r) => r.user_id)).size;

    const mList = (mpesa.data ?? []) as any[];
    const mpesaFailures = mList.filter((m) => m.status === "failed").length;
    const mpesaSuccess = mList.filter(
      (m) => m.status === "success" || m.status === "completed",
    ).length;

    return {
      bookings: {
        totalRecent: bList.length,
        cancelledWeek: bList.filter(
          (b) => b.status === "cancelled" && new Date(b.created_at) >= weekAgo,
        ).length,
        cancelRateWeek: cancelRate,
        highValue: bList.filter((b) => Number(b.total_amount ?? 0) > 500000).length,
        duplicateSameDay: dupGuests,
      },
      throttling: {
        eventsRecent: rateList.length,
        distinctUsers: throttledUsers,
      },
      payments: {
        mpesaFailures,
        mpesaSuccess,
        failureRate:
          mpesaSuccess + mpesaFailures > 0
            ? Math.round((mpesaFailures / (mpesaSuccess + mpesaFailures)) * 100)
            : 0,
      },
      claims: {
        pending: ((claims.data ?? []) as any[]).filter((c) => c.status === "pending").length,
        rejected: ((claims.data ?? []) as any[]).filter((c) => c.status === "rejected").length,
      },
      audit: (audit.data ?? []) as any[],
      generatedAt: new Date().toISOString(),
    };
  });

// -----------------------------------------------------------------------------
// CMS (Content — counties, discovery sources, guides)
// -----------------------------------------------------------------------------

export const adminCmsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await requireAdmin(context);

    const [counties, sources, discovered, reviews, coupons] = await Promise.all([
      s.from("kenya_counties").select("id, name, slug").order("name"),
      s.from("discovery_sources").select("id, name, kind, active, last_run_at").order("name"),
      s.from("discovered_properties").select("id, status").limit(1000),
      s
        .from("marketplace_property_reviews")
        .select("id, rating, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      s.from("coupons").select("id, code, active, redeemed_count, max_redemptions"),
    ]);

    const dp = (discovered.data ?? []) as any[];
    return {
      counties: (counties.data ?? []) as any[],
      sources: (sources.data ?? []) as any[],
      discovery: {
        total: dp.length,
        pending: dp.filter((d) => d.status === "pending_review").length,
        published: dp.filter((d) => d.status === "published").length,
        rejected: dp.filter((d) => d.status === "rejected").length,
      },
      recentReviews: (reviews.data ?? []) as any[],
      coupons: (coupons.data ?? []) as any[],
      generatedAt: new Date().toISOString(),
    };
  });

// -----------------------------------------------------------------------------
// DevOps (errors, performance, webhooks)
// -----------------------------------------------------------------------------

export const adminDevopsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await requireAdmin(context);
    const now = new Date();
    const today = startOfDayUTC(now);
    const weekAgo = addDays(today, -6);

    const [errors, syncRuns, webhookDeliveries, discoveryRuns, subEvents] = await Promise.all([
      s
        .from("app_errors")
        .select("id, severity, message, route, created_at, metadata")
        .order("created_at", { ascending: false })
        .limit(100),
      s
        .from("external_sync_runs")
        .select("id, status, started_at, finished_at, source, items_processed, errors")
        .order("started_at", { ascending: false })
        .limit(50),
      s
        .from("ical_webhook_deliveries")
        .select("id, status, response_status, attempts, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      s
        .from("discovery_runs")
        .select("id, status, started_at, finished_at, items_found")
        .order("started_at", { ascending: false })
        .limit(30),
      s
        .from("subscription_events")
        .select("id, kind, created_at")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    const eList = (errors.data ?? []) as any[];
    const bySeverity = eList.reduce(
      (acc, e) => {
        const k = e.severity ?? "info";
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const wh = (webhookDeliveries.data ?? []) as any[];
    const whFailed = wh.filter(
      (w) => (w.status ?? "").toLowerCase() === "failed" || Number(w.response_status ?? 0) >= 400,
    ).length;

    return {
      errors: {
        recent: eList.slice(0, 25),
        totalWeek: eList.filter((e) => new Date(e.created_at) >= weekAgo).length,
        bySeverity,
        criticalWeek: eList.filter(
          (e) =>
            new Date(e.created_at) >= weekAgo &&
            (e.severity === "critical" || e.severity === "error"),
        ).length,
      },
      syncs: {
        recent: (syncRuns.data ?? []) as any[],
        failedWeek: ((syncRuns.data ?? []) as any[]).filter(
          (r) => r.status === "failed" && new Date(r.started_at) >= weekAgo,
        ).length,
      },
      webhooks: {
        recent: wh.slice(0, 20),
        failedRecent: whFailed,
        total: wh.length,
      },
      discovery: {
        recent: (discoveryRuns.data ?? []) as any[],
      },
      subscriptions: {
        recentEvents: (subEvents.data ?? []) as any[],
      },
      health: {
        errorsCritical: eList.filter((e) => e.severity === "critical").length,
        status:
          eList.filter((e) => e.severity === "critical").length > 5 ? "degraded" : "operational",
      },
      generatedAt: new Date().toISOString(),
    };
  });
