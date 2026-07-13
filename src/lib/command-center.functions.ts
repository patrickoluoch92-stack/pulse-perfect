// Owner Command Center aggregation. One server function fetches every KPI
// the dashboard needs so the page renders in a single round-trip.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasOrgRole, isPlatformAdmin } from "@/lib/access";

const input = z.object({ orgId: z.string().uuid() });

function startOfDayUTC(d = new Date()) {
  const x = new Date(d); x.setUTCHours(0,0,0,0); return x;
}
function addDays(d: Date, n: number) { return new Date(d.getTime() + n * 86400000); }
function isoDate(d: Date) { return d.toISOString().slice(0,10); }

export const getOwnerCommandCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => input.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const isMember =
      (await isPlatformAdmin(supabase, userId)) ||
      (await hasOrgRole(supabase, userId, data.orgId, ["owner", "enterprise_admin", "admin", "manager", "staff"]));
    if (!isMember) throw new Error("Forbidden");

    const now = new Date();
    const today = startOfDayUTC(now);
    const weekAgo = addDays(today, -6);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const todayISO = isoDate(today);
    const tomorrowISO = isoDate(addDays(today, 1));

    // Property IDs owned by this org (for booking joins).
    const { data: props, error: pErr } = await supabase
      .from("marketplace_properties")
      .select("id, status, city, county_code")
      .eq("org_id", data.orgId);
    if (pErr) throw new Error(pErr.message);
    const propertyIds = (props ?? []).map((p: any) => p.id);
    const propertyCount = props?.length ?? 0;
    const publishedCount = (props ?? []).filter((p: any) => p.status === "approved" || p.status === "published").length;

    // Bookings scoped to this org's properties.
    const bookingsQ = propertyIds.length
      ? supabase.from("marketplace_bookings")
          .select("id, status, total_amount, check_in, check_out, guest_name, guest_email, created_at, property_id")
          .in("property_id", propertyIds)
      : null;

    const [bookingsRes, wallet, subQ, unitsQ, ticketsQ, hkQ, reviewsQ] = await Promise.all([
      bookingsQ ? bookingsQ : Promise.resolve({ data: [] as any[] }),
      supabase.from("owner_wallets").select("*").eq("org_id", data.orgId).maybeSingle(),
      supabase.from("subscriptions").select("plan, status, current_period_end, cancel_at_period_end")
        .eq("org_id", data.orgId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("units").select("id, status", { count: "exact" }).eq("org_id", data.orgId),
      supabase.from("maintenance_tickets").select("id, priority, status").eq("org_id", data.orgId).neq("status","resolved").limit(50),
      supabase.from("housekeeping_tasks").select("id, status, scheduled_for").eq("org_id", data.orgId).neq("status","done").limit(50),
      supabase.from("marketplace_property_reviews").select("rating, comment, created_at, property_id")
        .in("property_id", propertyIds.length ? propertyIds : ["00000000-0000-0000-0000-000000000000"])
        .order("created_at", { ascending: false }).limit(20),
    ]);

    const bookings: any[] = (bookingsRes as any).data ?? [];

    const revenueSince = (from: Date) =>
      bookings.filter((b) => ["confirmed","completed"].includes(b.status) && new Date(b.created_at) >= from)
        .reduce((s, b) => s + Number(b.total_amount ?? 0), 0);

    const nightsOverlapping = (from: Date, to: Date) =>
      bookings.filter((b) => ["confirmed","completed"].includes(b.status))
        .reduce((sum, b) => {
          const ci = new Date(b.check_in); const co = new Date(b.check_out);
          const start = ci > from ? ci : from;
          const end = co < to ? co : to;
          const days = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 86400000));
          return sum + days;
        }, 0);

    const unitCount = (unitsQ.data ?? []).length || (unitsQ as any).count || 0;
    const daySpan = (from: Date, to: Date) =>
      Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000));
    const occRate = (from: Date, to: Date) => {
      const cap = Math.max(1, unitCount) * daySpan(from, to);
      return Math.min(1, nightsOverlapping(from, to) / cap);
    };

    const checkInsToday = bookings.filter((b) => b.check_in === todayISO && ["confirmed","pending"].includes(b.status));
    const checkOutsToday = bookings.filter((b) => b.check_out === todayISO && ["confirmed","completed"].includes(b.status));
    const pendingBookings = bookings.filter((b) => b.status === "pending");
    const confirmedBookings = bookings.filter((b) => b.status === "confirmed");

    const reviews = (reviewsQ.data ?? []) as any[];
    const avgRating = reviews.length
      ? Math.round((reviews.reduce((s, r) => s + Number(r.rating ?? 0), 0) / reviews.length) * 10) / 10
      : null;

    // AI Health Score (deterministic composite 0-100)
    const occNow = occRate(weekAgo, addDays(today, 1));
    const respWeight = Math.min(1, publishedCount / Math.max(1, propertyCount));
    const ratingScore = avgRating ? (avgRating / 5) : 0.6;
    const maintPenalty = Math.min(0.3, (ticketsQ.data ?? []).length * 0.03);
    const healthScore = Math.max(0, Math.min(100,
      Math.round((occNow * 40 + ratingScore * 30 + respWeight * 20 + 10 - maintPenalty * 100))
    ));

    // Actionable alerts
    const alerts: { level: "info"|"warn"|"error"; message: string; href?: string }[] = [];
    if ((ticketsQ.data ?? []).some((t: any) => t.priority === "urgent")) {
      alerts.push({ level: "error", message: "Urgent maintenance tickets need attention", href: "/maintenance" });
    }
    if (pendingBookings.length > 0) {
      alerts.push({ level: "warn", message: `${pendingBookings.length} booking(s) awaiting confirmation`, href: "/reservations" });
    }
    if (publishedCount === 0 && propertyCount > 0) {
      alerts.push({ level: "warn", message: "You have unpublished properties. Publish them to start receiving bookings.", href: "/listings" });
    }
    const s = (subQ as any).data;
    if (s?.cancel_at_period_end) alerts.push({ level: "warn", message: "Subscription is set to cancel at period end", href: "/subscription" });
    if (!s || s?.status !== "active") alerts.push({ level: "info", message: "Upgrade your plan to unlock premium features", href: "/pricing" });

    return {
      propertyCount, publishedCount, unitCount,
      occupancy: {
        today: occRate(today, addDays(today,1)),
        week: occRate(weekAgo, addDays(today,1)),
        month: occRate(monthStart, addDays(today,1)),
      },
      revenue: {
        today: revenueSince(today),
        month: revenueSince(monthStart),
        year: revenueSince(yearStart),
      },
      bookings: {
        pending: pendingBookings.length,
        confirmed: confirmedBookings.length,
        checkInsToday: checkInsToday.length,
        checkOutsToday: checkOutsToday.length,
        recent: bookings.slice(0, 5).map((b) => ({
          id: b.id, guest: b.guest_name, status: b.status,
          check_in: b.check_in, check_out: b.check_out, total: Number(b.total_amount ?? 0),
        })),
      },
      wallet: (wallet as any).data ?? null,
      subscription: s ?? null,
      maintenance: { open: (ticketsQ.data ?? []).length, urgent: (ticketsQ.data ?? []).filter((t: any) => t.priority === "urgent").length },
      housekeeping: { open: (hkQ.data ?? []).length },
      reviews: { count: reviews.length, avgRating, recent: reviews.slice(0, 3) },
      healthScore,
      alerts,
      generatedAt: new Date().toISOString(),
    };
  });
