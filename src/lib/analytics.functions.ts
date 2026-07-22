import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  orgId: z.string().uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function daysBetween(a: string, b: string) {
  const ms = new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}
function maxDate(a: string, b: string) {
  return a > b ? a : b;
}
function minDate(a: string, b: string) {
  return a < b ? a : b;
}
function addDays(d: string, n: number) {
  const dt = new Date(d + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export const getAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { orgId, from, to } = data;

    // Plan gate: analytics requires professional or higher.
    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .select("plan")
      .eq("id", orgId)
      .maybeSingle();
    if (orgErr) throw new Error(orgErr.message);
    const { planAllows } = await import("@/lib/plans");
    if (!planAllows(org?.plan as any, "analytics.basic")) {
      throw new Error("PLAN_REQUIRED:professional");
    }

    const periodNights = daysBetween(from, to);

    const [unitsRes, resRes] = await Promise.all([
      supabase.from("units").select("id", { count: "exact" }).eq("org_id", orgId),
      supabase
        .from("reservations")
        .select("id, status, source, check_in, check_out, total_amount, currency, property_id")
        .eq("org_id", orgId)
        .lt("check_in", to)
        .gt("check_out", from),
    ]);

    if (unitsRes.error) throw new Error(unitsRes.error.message);
    if (resRes.error) throw new Error(resRes.error.message);

    const unitCount = unitsRes.count ?? 0;
    const reservations = (resRes.data ?? []).filter(
      (r) => r.status !== "cancelled" && r.status !== "no_show",
    );

    const availableNights = unitCount * periodNights;

    // Build daily series
    const series: { date: string; occupied: number; revenue: number }[] = [];
    for (let i = 0; i < periodNights; i++) {
      series.push({ date: addDays(from, i), occupied: 0, revenue: 0 });
    }
    const seriesIdx = new Map(series.map((s, i) => [s.date, i]));

    let occupiedNights = 0;
    let revenue = 0;
    const bookings = reservations.length;
    const sourceBreakdown: Record<string, number> = {};
    const propertyRevenue: Record<string, number> = {};

    for (const r of reservations) {
      const start = maxDate(r.check_in, from);
      const end = minDate(r.check_out, to);
      const nightsInPeriod = daysBetween(start, end);
      if (nightsInPeriod <= 0) continue;

      const totalNights = daysBetween(r.check_in, r.check_out) || 1;
      const adr = Number(r.total_amount) / totalNights;
      const portionRevenue = adr * nightsInPeriod;

      occupiedNights += nightsInPeriod;
      revenue += portionRevenue;
      sourceBreakdown[r.source] = (sourceBreakdown[r.source] ?? 0) + 1;
      propertyRevenue[r.property_id] = (propertyRevenue[r.property_id] ?? 0) + portionRevenue;

      for (let d = start; d < end; d = addDays(d, 1)) {
        const idx = seriesIdx.get(d);
        if (idx !== undefined) {
          series[idx].occupied += 1;
          series[idx].revenue += adr;
        }
      }
    }

    const occupancyRate = availableNights > 0 ? occupiedNights / availableNights : 0;
    const adr = occupiedNights > 0 ? revenue / occupiedNights : 0;
    const revpar = availableNights > 0 ? revenue / availableNights : 0;

    // Property names for revenue chart
    const propIds = Object.keys(propertyRevenue);
    let propertyChart: { name: string; revenue: number }[] = [];
    if (propIds.length) {
      const { data: props } = await supabase
        .from("properties")
        .select("id, name")
        .in("id", propIds);
      propertyChart = (props ?? [])
        .map((p) => ({
          name: p.name,
          revenue: Math.round((propertyRevenue[p.id] ?? 0) * 100) / 100,
        }))
        .sort((a, b) => b.revenue - a.revenue);
    }

    return {
      periodNights,
      unitCount,
      availableNights,
      occupiedNights,
      occupancyRate,
      adr,
      revpar,
      revenue,
      bookings,
      sourceBreakdown,
      series: series.map((s) => ({
        ...s,
        revenue: Math.round(s.revenue * 100) / 100,
      })),
      propertyChart,
    };
  });
