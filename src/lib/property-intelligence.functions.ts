// Property Intelligence Dashboard aggregator. One server fn returns every KPI
// the /listings/intelligence route needs so the page renders in one round-trip.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasOrgRole, isPlatformAdmin } from "@/lib/access";
import { verifyProperty } from "@/lib/verification.server";

const input = z.object({ orgId: z.string().uuid() });

export type PropertyIntelSummary = {
  totals: {
    listings: number;
    published: number;
    verified: number;
    draft: number;
    submitted: number;
    rejected: number;
  };
  quality: { avg: number; low: number; high: number };
  geo: { counties: number; towns: number; withCoords: number };
  bookings: { last30: number; revenueKes30: number; upcoming: number };
  search: { queriesLast7: number; avgLatencyMs: number | null };
  needsAttention: Array<{
    id: string;
    name: string;
    score: number;
    missing: string[];
    status: string;
  }>;
  recommendations: string[];
};

export const getPropertyIntelligence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => input.parse(raw))
  .handler(async ({ data, context }): Promise<PropertyIntelSummary> => {
    const { supabase, userId } = context;
    const allowed =
      (await isPlatformAdmin(supabase, userId)) ||
      (await hasOrgRole(supabase, userId, data.orgId, [
        "owner",
        "enterprise_admin",
        "admin",
        "manager",
        "staff",
      ]));
    if (!allowed) throw new Error("Forbidden");

    const now = Date.now();
    const thirtyAgo = new Date(now - 30 * 86400000).toISOString();
    const sevenAgo = new Date(now - 7 * 86400000).toISOString();

    const { data: props, error: pErr } = await supabase
      .from("marketplace_properties")
      .select(
        "id, name, status, is_verified, latitude, longitude, town, county_code, description, category, price_per_night, rent_monthly, sale_price, contact_phone, contact_email, amenities, main_image_path, listing_intent",
      )
      .eq("org_id", data.orgId);
    if (pErr) throw new Error(pErr.message);
    const rows = (props ?? []) as any[];
    const propertyIds = rows.map((r) => r.id);

    // Per-row verification report (deterministic, fast).
    const reports = rows.map((r) => ({ row: r, report: verifyProperty(r) }));
    const scores = reports.map((r) => r.report.score);
    const avgScore = scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
    const lowScore = reports.filter((r) => r.report.score < 60).length;
    const highScore = reports.filter((r) => r.report.score >= 85).length;

    const counties = new Set(rows.map((r) => r.county_code).filter(Boolean));
    const towns = new Set(rows.map((r) => r.town).filter(Boolean));
    const withCoords = rows.filter((r) => r.latitude != null && r.longitude != null).length;

    // Bookings (last 30 days revenue + upcoming).
    const [bookingsRes, upcomingRes, searchRes] = await Promise.all([
      propertyIds.length
        ? supabase
            .from("marketplace_bookings")
            .select("id, total_amount, created_at")
            .in("property_id", propertyIds)
            .gte("created_at", thirtyAgo)
            .in("status", ["confirmed", "completed"])
        : Promise.resolve({ data: [] as any[] }),
      propertyIds.length
        ? supabase
            .from("marketplace_bookings")
            .select("id")
            .in("property_id", propertyIds)
            .gte("check_in", new Date().toISOString().slice(0, 10))
            .in("status", ["confirmed", "pending"])
        : Promise.resolve({ data: [] as any[] }),
      supabase
        .from("knowledge_search_events")
        .select("latency_ms, created_at")
        .gte("created_at", sevenAgo)
        .limit(500),
    ]);
    const bookings = (bookingsRes as any).data ?? [];
    const revenue30 = bookings.reduce((s: number, b: any) => s + Number(b.total_amount ?? 0), 0);
    const upcoming = ((upcomingRes as any).data ?? []).length;

    const searches = ((searchRes as any).data ?? []) as Array<{ latency_ms: number | null }>;
    const latencies = searches
      .map((s) => s.latency_ms)
      .filter((n): n is number => typeof n === "number");
    const avgLatency = latencies.length
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null;

    const needsAttention = reports
      .filter((r) => r.report.score < 85)
      .sort((a, b) => a.report.score - b.report.score)
      .slice(0, 6)
      .map((r) => ({
        id: r.row.id,
        name: r.row.name,
        score: r.report.score,
        missing: r.report.missing,
        status: r.row.status,
      }));

    const recs: string[] = [];
    if (lowScore > 0)
      recs.push(`${lowScore} listing(s) below 60% quality — complete missing fields first.`);
    if (withCoords < rows.length)
      recs.push(
        `${rows.length - withCoords} listing(s) missing GPS pins — add coordinates to boost map search.`,
      );
    const noPhoto = rows.filter((r) => !r.main_image_path).length;
    if (noPhoto > 0)
      recs.push(
        `${noPhoto} listing(s) missing a main photo — listings with photos convert 3× better.`,
      );
    if (counties.size < 2 && rows.length > 3)
      recs.push(
        "Portfolio concentrated in one county — geographic diversification lowers seasonality risk.",
      );
    if (avgLatency && avgLatency > 2000)
      recs.push(
        `Search latency averaging ${avgLatency}ms — enable embedding backfill to speed up guest search.`,
      );
    if (!recs.length) recs.push("Portfolio in great shape. Focus on marketing to lift bookings.");

    const totals = {
      listings: rows.length,
      published: rows.filter((r) => r.status === "approved" || r.status === "published").length,
      verified: rows.filter((r) => r.is_verified).length,
      draft: rows.filter((r) => r.status === "draft").length,
      submitted: rows.filter((r) => r.status === "submitted" || r.status === "pending").length,
      rejected: rows.filter((r) => r.status === "rejected").length,
    };

    return {
      totals,
      quality: { avg: avgScore, low: lowScore, high: highScore },
      geo: { counties: counties.size, towns: towns.size, withCoords },
      bookings: { last30: bookings.length, revenueKes30: Math.round(revenue30), upcoming },
      search: { queriesLast7: searches.length, avgLatencyMs: avgLatency },
      needsAttention,
      recommendations: recs,
    };
  });
