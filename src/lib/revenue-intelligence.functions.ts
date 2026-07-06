// Booking & Revenue Intelligence Engine — pricing + forecasting server fns.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceRateLimit } from "@/lib/rate-limit";

// ---------------- Pricing recommendation ----------------

const PriceInput = z.object({
  unitId: z.string().uuid(),
  horizonDays: z.number().int().min(1).max(120).default(30),
});

type PricingSuggestion = {
  date: string;
  baseRate: number;
  suggestedRate: number;
  demandScore: number; // 0..1
  reason: string;
};

/**
 * Deterministic, transparent pricing model — no proprietary competitor data.
 * Inputs: unit base rate, observed reservations, day-of-week & lead-time signals.
 */
export const recommendPricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PriceInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await enforceRateLimit({ bucket: "revenue.pricing", userId, limit: 60, windowSec: 60 });

    const { data: unit, error: uErr } = await supabase
      .from("units")
      .select("id, name, base_price, property_id")
      .eq("id", data.unitId)
      .maybeSingle();
    if (uErr || !unit) throw new Error("Unit not found");

    const base = Number(unit.base_price) || 0;
    if (base <= 0) throw new Error("Set a base price on this unit first.");

    const today = new Date();
    const start = today.toISOString().slice(0, 10);
    const end = new Date(today.getTime() + data.horizonDays * 86400_000)
      .toISOString()
      .slice(0, 10);

    const { data: reservations } = await supabase
      .from("reservations")
      .select("check_in, check_out, status")
      .eq("unit_id", data.unitId)
      .gte("check_out", start)
      .lte("check_in", end);

    const bookedDates = new Set<string>();
    for (const r of reservations ?? []) {
      if (r.status === "cancelled") continue;
      const s = new Date(r.check_in);
      const e = new Date(r.check_out);
      for (let d = new Date(s); d < e; d = new Date(d.getTime() + 86400_000)) {
        bookedDates.add(d.toISOString().slice(0, 10));
      }
    }

    const suggestions: PricingSuggestion[] = [];
    for (let i = 0; i < data.horizonDays; i++) {
      const dt = new Date(today.getTime() + i * 86400_000);
      const iso = dt.toISOString().slice(0, 10);
      const dow = dt.getUTCDay();
      const leadDays = i;

      let multiplier = 1;
      const reasons: string[] = [];
      if (dow === 5 || dow === 6) {
        multiplier *= 1.15;
        reasons.push("weekend demand");
      }
      // Lead-time: last-minute discount, early-bird bump
      if (leadDays <= 2 && !bookedDates.has(iso)) {
        multiplier *= 0.9;
        reasons.push("last-minute discount");
      } else if (leadDays > 45) {
        multiplier *= 1.05;
        reasons.push("early-bird premium");
      }
      // Neighbourhood occupancy signal — booked density within ±3 days
      let neighbourBooked = 0;
      for (let k = -3; k <= 3; k++) {
        const nd = new Date(dt.getTime() + k * 86400_000).toISOString().slice(0, 10);
        if (bookedDates.has(nd)) neighbourBooked++;
      }
      const localOcc = neighbourBooked / 7;
      if (localOcc >= 0.6) {
        multiplier *= 1.12;
        reasons.push("high local occupancy");
      } else if (localOcc <= 0.15) {
        multiplier *= 0.95;
        reasons.push("soft demand");
      }
      const suggested = Math.round(base * multiplier);
      suggestions.push({
        date: iso,
        baseRate: base,
        suggestedRate: suggested,
        demandScore: Math.min(1, localOcc + (dow === 5 || dow === 6 ? 0.2 : 0)),
        reason: reasons.length ? reasons.join(", ") : "baseline",
      });
    }

    return { unitId: data.unitId, unitName: unit.name, base, suggestions };
  });

// ---------------- Occupancy forecast ----------------

const ForecastInput = z.object({
  propertyId: z.string().uuid().optional(),
  days: z.number().int().min(7).max(180).default(60),
});

export const forecastOccupancy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ForecastInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const today = new Date();
    const start = today.toISOString().slice(0, 10);
    const end = new Date(today.getTime() + data.days * 86400_000).toISOString().slice(0, 10);

    let unitsQ = supabase.from("units").select("id, property_id");
    if (data.propertyId) unitsQ = unitsQ.eq("property_id", data.propertyId);
    const { data: units } = await unitsQ;
    const unitIds = (units ?? []).map((u) => u.id);
    if (unitIds.length === 0) return { days: [], summary: { avgOccupancy: 0, totalNights: 0 } };

    const { data: resv } = await supabase
      .from("reservations")
      .select("check_in, check_out, status, unit_id")
      .in("unit_id", unitIds)
      .gte("check_out", start)
      .lte("check_in", end);

    const perDay = new Map<string, number>();
    for (const r of resv ?? []) {
      if (r.status === "cancelled") continue;
      const s = new Date(r.check_in);
      const e = new Date(r.check_out);
      for (let d = new Date(s); d < e; d = new Date(d.getTime() + 86400_000)) {
        const k = d.toISOString().slice(0, 10);
        perDay.set(k, (perDay.get(k) ?? 0) + 1);
      }
    }

    const days: Array<{ date: string; occupancy: number; nights: number }> = [];
    let totalNights = 0;
    for (let i = 0; i < data.days; i++) {
      const iso = new Date(today.getTime() + i * 86400_000).toISOString().slice(0, 10);
      const nights = perDay.get(iso) ?? 0;
      totalNights += nights;
      days.push({ date: iso, nights, occupancy: nights / unitIds.length });
    }
    return {
      days,
      summary: {
        avgOccupancy: days.reduce((a, b) => a + b.occupancy, 0) / days.length,
        totalNights,
        unitCount: unitIds.length,
      },
    };
  });

// ---------------- AI-driven revenue insights ----------------

export const generateRevenueInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ propertyId: z.string().uuid().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await enforceRateLimit({ bucket: "revenue.insights", userId, limit: 20, windowSec: 300 });

    let q = supabase.from("units").select("id, name, base_price, property_id");
    if (data.propertyId) q = q.eq("property_id", data.propertyId);
    const { data: units } = await q;
    const unitIds = (units ?? []).map((u) => u.id);

    const today = new Date();
    const start = new Date(today.getTime() - 90 * 86400_000).toISOString().slice(0, 10);
    const { data: resv } = await supabase
      .from("reservations")
      .select("check_in, check_out, total_amount, status")
      .in("unit_id", unitIds.length ? unitIds : ["00000000-0000-0000-0000-000000000000"])
      .gte("check_in", start);

    const stats = {
      units: unitIds.length,
      reservations90d: (resv ?? []).length,
      revenue90d: (resv ?? [])
        .filter((r) => r.status !== "cancelled")
        .reduce((s, r) => s + Number(r.total_amount ?? 0), 0),
      cancelled: (resv ?? []).filter((r) => r.status === "cancelled").length,
    };

    const { aiJSON } = await import("./ai.server");
    const insights = await aiJSON<{
      summary: string;
      recommendations: Array<{ title: string; detail: string; impact: "high" | "medium" | "low" }>;
    }>({
      system:
        "You are a hospitality revenue analyst. Return concise, actionable recommendations grounded in the provided KPIs. Never fabricate numbers.",
      user: `Property KPIs (last 90 days): ${JSON.stringify(stats)}. Suggest 4 concrete revenue-improvement actions.`,
      schema: {
        name: "revenue_insights",
        schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  detail: { type: "string" },
                  impact: { type: "string", enum: ["high", "medium", "low"] },
                },
                required: ["title", "detail", "impact"],
              },
            },
          },
          required: ["summary", "recommendations"],
        },
      },
    });

    return { stats, insights };
  });
