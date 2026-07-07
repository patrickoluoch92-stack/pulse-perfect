// Competitor rate + event signals feeding the pricing engine.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SignalInput = z.object({
  propertyId: z.string().uuid().optional(),
  orgId: z.string().uuid().optional(),
  signalType: z.enum(["competitor_rate", "event", "holiday", "weather", "demand_spike"]),
  regionCode: z.string().max(16).optional(),
  observedOn: z.string(),
  validUntil: z.string().optional(),
  priceAmount: z.number().optional(),
  currency: z.string().max(8).optional(),
  weight: z.number().min(0).max(5).default(1),
  payload: z.record(z.string(), z.unknown()).default({}),
  source: z.string().max(120).optional(),
});

export const recordPricingSignal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SignalInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin" as any,
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { error, data: row } = await supabase
      .from("pricing_signals")
      .insert({
        property_id: data.propertyId ?? null,
        org_id: data.orgId ?? null,
        signal_type: data.signalType,
        region_code: data.regionCode ?? null,
        observed_on: data.observedOn,
        valid_until: data.validUntil ?? null,
        price_amount: data.priceAmount ?? null,
        currency: data.currency ?? "KES",
        weight: data.weight,
        payload: data.payload,
        source: data.source ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/**
 * Fetch pricing signals affecting a property between two dates.
 * Uses property-specific + region-wide signals.
 */
export async function fetchSignals(
  supabase: any,
  opts: { propertyId?: string | null; regionCode?: string | null; from: string; to: string },
) {
  let q = supabase
    .from("pricing_signals")
    .select("signal_type, observed_on, valid_until, price_amount, weight, payload, region_code, property_id")
    .lte("observed_on", opts.to)
    .or(`valid_until.is.null,valid_until.gte.${opts.from}`);

  const filters: string[] = [];
  if (opts.propertyId) filters.push(`property_id.eq.${opts.propertyId}`);
  if (opts.regionCode) filters.push(`region_code.eq.${opts.regionCode}`);
  if (filters.length) q = q.or(filters.join(","));

  const { data } = await q;
  return data ?? [];
}

/**
 * Given signals for a date, produce a multiplicative adjustment and reasons.
 */
export function applySignalsForDate(
  date: string,
  baseRate: number,
  signals: Array<{
    signal_type: string;
    observed_on: string;
    valid_until: string | null;
    price_amount: number | null;
    weight: number;
  }>,
): { multiplier: number; reasons: string[] } {
  let mult = 1;
  const reasons: string[] = [];
  for (const s of signals) {
    if (s.observed_on > date) continue;
    if (s.valid_until && s.valid_until < date) continue;
    switch (s.signal_type) {
      case "competitor_rate":
        if (s.price_amount && baseRate > 0) {
          // Nudge 30% toward the competitor rate, weighted
          const ratio = Number(s.price_amount) / baseRate;
          const nudge = 1 + (ratio - 1) * 0.3 * Number(s.weight);
          mult *= Math.max(0.7, Math.min(1.5, nudge));
          reasons.push("competitor rate");
        }
        break;
      case "event":
        mult *= 1 + 0.2 * Number(s.weight);
        reasons.push("local event");
        break;
      case "holiday":
        mult *= 1 + 0.15 * Number(s.weight);
        reasons.push("holiday");
        break;
      case "demand_spike":
        mult *= 1 + 0.1 * Number(s.weight);
        reasons.push("demand spike");
        break;
      case "weather":
        mult *= 1 - 0.05 * Number(s.weight);
        reasons.push("weather adjustment");
        break;
    }
  }
  return { multiplier: mult, reasons };
}
