// Executive Command Center aggregation. Admin-only. Pulls cross-platform KPIs
// from bookings, properties, users, wallets, subscriptions, discovery, and
// support surfaces in a single call.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isPlatformAdmin } from "@/lib/access";

function startOfDayUTC(d = new Date()) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * 86400000);
}

export const getExecutiveOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const admin = await isPlatformAdmin(supabase, userId);
    if (!admin) throw new Error("Forbidden: platform admin required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = supabaseAdmin;

    const now = new Date();
    const today = startOfDayUTC(now);
    const weekAgo = addDays(today, -6);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

    const [
      props,
      bookings,
      commissions,
      subs,
      wallets,
      payouts,
      users,
      orgs,
      discovered,
      claims,
      appErrors,
      reviews,
      coupons,
      tickets,
    ] = await Promise.all([
      s
        .from("marketplace_properties")
        .select("id, status, is_published, is_featured, verification_status, org_id, created_at"),
      s
        .from("marketplace_bookings")
        .select("id, status, total_amount, check_in, check_out, created_at, property_id"),
      s
        .from("booking_commissions")
        .select("id, gross_amount, commission_amount, net_amount, status, created_at"),
      s
        .from("subscriptions")
        .select("id, plan, status, current_period_end, price_amount, created_at"),
      s
        .from("owner_wallets")
        .select("org_id, available_balance, pending_balance, lifetime_earnings"),
      s.from("payouts").select("id, amount, status, requested_at, processed_at"),
      s.from("profiles").select("id, created_at"),
      s.from("organizations").select("id, created_at"),
      s.from("discovered_properties").select("id, status, created_at"),
      s.from("property_claims").select("id, status, created_at"),
      s
        .from("app_errors")
        .select("id, severity, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      s.from("marketplace_property_reviews").select("rating, created_at"),
      s.from("coupons").select("id, active"),
      s.from("maintenance_tickets").select("id, status, priority"),
    ]);

    const err = (r: any) => (r.error ? r.error.message : null);
    const errors = [
      props,
      bookings,
      commissions,
      subs,
      wallets,
      payouts,
      users,
      orgs,
      discovered,
      claims,
      appErrors,
      reviews,
      coupons,
      tickets,
    ]
      .map(err)
      .filter(Boolean);

    const bList: any[] = bookings.data ?? [];
    const cList: any[] = commissions.data ?? [];
    const sList: any[] = subs.data ?? [];
    const pList: any[] = props.data ?? [];
    const wList: any[] = wallets.data ?? [];
    const payList: any[] = payouts.data ?? [];

    const sinceRev = (from: Date) =>
      bList
        .filter(
          (b) => ["confirmed", "completed"].includes(b.status) && new Date(b.created_at) >= from,
        )
        .reduce((s, b) => s + Number(b.total_amount ?? 0), 0);

    const commissionSince = (from: Date) =>
      cList
        .filter((c) => new Date(c.created_at) >= from && c.status !== "reversed")
        .reduce((s, c) => s + Number(c.commission_amount ?? 0), 0);

    const subRevMonth = sList
      .filter((x) => x.status === "active" && new Date(x.created_at) >= monthStart)
      .reduce((s, x) => s + Number(x.price_amount ?? 0), 0);

    const gbvMonth = sinceRev(monthStart);
    const netMonth = commissionSince(monthStart) + subRevMonth;

    const upcomingCheckins = bList.filter(
      (b) =>
        new Date(b.check_in) >= today &&
        new Date(b.check_in) < addDays(today, 8) &&
        b.status !== "cancelled",
    ).length;
    const upcomingCheckouts = bList.filter(
      (b) =>
        new Date(b.check_out) >= today &&
        new Date(b.check_out) < addDays(today, 8) &&
        b.status !== "cancelled",
    ).length;

    const bookingsToday = bList.filter((b) => new Date(b.created_at) >= today).length;
    const bookingsMonth = bList.filter((b) => new Date(b.created_at) >= monthStart).length;

    const errRecent = (appErrors.data ?? []) as any[];
    const errWeek = errRecent.filter((e) => new Date(e.created_at) >= weekAgo).length;
    const errCritical = errRecent.filter(
      (e) => e.severity === "critical" || e.severity === "error",
    ).length;

    const reviewsList = (reviews.data ?? []) as any[];
    const avgRating = reviewsList.length
      ? Math.round(
          (reviewsList.reduce((s, r) => s + Number(r.rating ?? 0), 0) / reviewsList.length) * 10,
        ) / 10
      : null;

    const walletOutstanding = wList.reduce(
      (s, w) => s + Number(w.available_balance ?? 0) + Number(w.pending_balance ?? 0),
      0,
    );
    const pendingPayouts = payList.filter(
      (p) => p.status === "requested" || p.status === "processing",
    ).length;
    const pendingPayoutAmount = payList
      .filter((p) => p.status === "requested" || p.status === "processing")
      .reduce((s, p) => s + Number(p.amount ?? 0), 0);

    // Health
    const dbHealth = errors.length === 0 ? "operational" : "degraded";
    const apiHealth = errCritical > 20 ? "degraded" : "operational";
    const paymentHealth = "operational";
    const aiHealth = "operational";

    // Activity feed (recent bookings + new users + errors, merged)
    const activity = [
      ...bList
        .slice(-15)
        .map((b) => ({
          type: "booking",
          at: b.created_at,
          message: `Booking ${b.status} · KES ${Number(b.total_amount ?? 0).toLocaleString()}`,
        })),
      ...((users.data ?? []) as any[])
        .slice(-10)
        .map((u) => ({ type: "signup", at: u.created_at, message: "New user registered" })),
      ...errRecent
        .slice(0, 10)
        .map((e) => ({
          type: "error",
          at: e.created_at,
          message: `System ${e.severity ?? "info"}`,
        })),
    ]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 25);

    return {
      revenue: {
        today: sinceRev(today),
        week: sinceRev(weekAgo),
        month: gbvMonth,
        year: sinceRev(yearStart),
        commissionMonth: commissionSince(monthStart),
        subscriptionMonth: subRevMonth,
        netMonth,
      },
      properties: {
        total: pList.length,
        published: pList.filter((p) => p.is_published).length,
        pending: pList.filter((p) => p.status === "pending").length,
        approved: pList.filter((p) => p.status === "approved").length,
        rejected: pList.filter((p) => p.status === "rejected").length,
        featured: pList.filter((p) => p.is_featured).length,
        verified: pList.filter((p) => p.verification_status === "verified").length,
      },
      discovery: {
        pending: ((discovered.data ?? []) as any[]).filter((d) => d.status === "pending_review")
          .length,
        published: ((discovered.data ?? []) as any[]).filter((d) => d.status === "published")
          .length,
        claims: ((claims.data ?? []) as any[]).filter((c) => c.status === "pending").length,
      },
      users: {
        total: (users.data ?? []).length,
        newToday: ((users.data ?? []) as any[]).filter((u) => new Date(u.created_at) >= today)
          .length,
        newMonth: ((users.data ?? []) as any[]).filter((u) => new Date(u.created_at) >= monthStart)
          .length,
      },
      organizations: {
        total: (orgs.data ?? []).length,
        newMonth: ((orgs.data ?? []) as any[]).filter((o) => new Date(o.created_at) >= monthStart)
          .length,
      },
      bookings: {
        today: bookingsToday,
        month: bookingsMonth,
        upcomingCheckins,
        upcomingCheckouts,
        pending: bList.filter((b) => b.status === "pending").length,
        cancelled: bList.filter((b) => b.status === "cancelled").length,
      },
      subscriptions: {
        active: sList.filter((x) => x.status === "active").length,
        trialing: sList.filter((x) => x.status === "trialing").length,
        canceled: sList.filter((x) => x.status === "canceled").length,
        pastDue: sList.filter((x) => x.status === "past_due").length,
      },
      finance: {
        walletOutstanding,
        pendingPayouts,
        pendingPayoutAmount,
        payoutsProcessedMonth: payList
          .filter(
            (p) =>
              p.status === "completed" && p.processed_at && new Date(p.processed_at) >= monthStart,
          )
          .reduce((s, p) => s + Number(p.amount ?? 0), 0),
      },
      support: {
        openTickets: ((tickets.data ?? []) as any[]).filter((t) => t.status !== "resolved").length,
        urgentTickets: ((tickets.data ?? []) as any[]).filter(
          (t) => t.priority === "urgent" && t.status !== "resolved",
        ).length,
        avgRating,
        totalReviews: reviewsList.length,
      },
      marketing: {
        activeCoupons: ((coupons.data ?? []) as any[]).filter((c) => c.active).length,
      },
      health: {
        db: dbHealth,
        api: apiHealth,
        payment: paymentHealth,
        ai: aiHealth,
        errorsWeek: errWeek,
        errorsCritical: errCritical,
      },
      activity,
      generatedAt: new Date().toISOString(),
    };
  });
