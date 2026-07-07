// Advanced AI analytics: cancellation risk, fraud signals, occupancy anomaly.
// All computations are deterministic over existing data — no external calls.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OrgInput = z.object({ orgId: z.string().uuid().optional() });

/**
 * Estimate cancellation risk for upcoming reservations from historical
 * cancellation rates by lead time and channel.
 */
export const cancellationRiskReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => OrgInput.parse(i))
  .handler(async ({ context }) => {
    const { supabase } = context;
    const today = new Date();
    const past = new Date(today.getTime() - 365 * 86400_000).toISOString().slice(0, 10);

    const { data: past365 } = await supabase
      .from("reservations")
      .select("id, status, source, check_in, created_at")
      .gte("created_at", past);

    const buckets = {
      "0-7": { total: 0, cancelled: 0 },
      "8-30": { total: 0, cancelled: 0 },
      "30+": { total: 0, cancelled: 0 },
    };
    for (const r of past365 ?? []) {
      const lead = Math.max(
        0,
        Math.round((new Date(r.check_in).getTime() - new Date(r.created_at).getTime()) / 86400_000),
      );
      const k = lead <= 7 ? "0-7" : lead <= 30 ? "8-30" : "30+";
      buckets[k].total++;
      if (r.status === "cancelled") buckets[k].cancelled++;
    }
    const rate = (b: { total: number; cancelled: number }) =>
      b.total === 0 ? 0 : b.cancelled / b.total;

    const { data: upcoming } = await supabase
      .from("reservations")
      .select("id, check_in, source, status, total_amount")
      .gte("check_in", today.toISOString().slice(0, 10))
      .neq("status", "cancelled")
      .limit(500);

    const atRisk = (upcoming ?? []).map((r) => {
      const lead = Math.max(
        0,
        Math.round((new Date(r.check_in).getTime() - today.getTime()) / 86400_000),
      );
      const b = lead <= 7 ? "0-7" : lead <= 30 ? "8-30" : "30+";
      const p = rate(buckets[b]);
      return {
        reservationId: r.id,
        checkIn: r.check_in,
        source: r.source,
        totalAmount: Number(r.total_amount ?? 0),
        cancellationProbability: Math.round(p * 100) / 100,
      };
    });
    atRisk.sort((a, b) => b.cancellationProbability - a.cancellationProbability);

    return {
      historicalRates: {
        "0-7": rate(buckets["0-7"]),
        "8-30": rate(buckets["8-30"]),
        "30+": rate(buckets["30+"]),
      },
      upcomingCount: atRisk.length,
      highRisk: atRisk.slice(0, 20),
      expectedCancellations: Math.round(
        atRisk.reduce((s, r) => s + r.cancellationProbability, 0),
      ),
    };
  });

/**
 * Fraud/anomaly signals over recent reservations and M-PESA transactions.
 * Flags duplicate guest identifiers, oddly high totals, rapid repeat bookings.
 */
export const fraudSignals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => OrgInput.parse(i))
  .handler(async ({ context }) => {
    const { supabase } = context;
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();

    const { data: resv } = await supabase
      .from("reservations")
      .select("id, guest_id, total_amount, created_at, status")
      .gte("created_at", since)
      .limit(1000);

    const flags: Array<{ type: string; reservationId: string; detail: string; severity: "low" | "medium" | "high" }> = [];
    const byGuest = new Map<string, number>();
    const totals: number[] = [];

    for (const r of resv ?? []) {
      if (r.guest_id) byGuest.set(r.guest_id, (byGuest.get(r.guest_id) ?? 0) + 1);
      totals.push(Number(r.total_amount ?? 0));
    }
    // High-value outlier: >4× median
    const sorted = totals.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    for (const r of resv ?? []) {
      const amt = Number(r.total_amount ?? 0);
      if (median > 0 && amt > median * 4) {
        flags.push({
          type: "outlier_amount",
          reservationId: r.id,
          detail: `${amt} vs median ${median}`,
          severity: "medium",
        });
      }
      if (r.guest_id && (byGuest.get(r.guest_id) ?? 0) >= 5) {
        flags.push({
          type: "repeat_guest_burst",
          reservationId: r.id,
          detail: `${byGuest.get(r.guest_id)} bookings in 30d`,
          severity: "low",
        });
      }
    }

    // M-PESA failures burst
    const { data: mpesa } = await supabase
      .from("mpesa_transactions")
      .select("id, status, created_at, amount, phone")
      .gte("created_at", since)
      .limit(1000);
    const failed = (mpesa ?? []).filter((t) => t.status === "failed" || t.status === "cancelled");
    const failByPhone = new Map<string, number>();
    for (const t of failed) {
      if (t.phone) failByPhone.set(t.phone, (failByPhone.get(t.phone) ?? 0) + 1);
    }
    for (const [phone, n] of failByPhone) {
      if (n >= 3) {
        flags.push({
          type: "mpesa_failure_burst",
          reservationId: phone,
          detail: `${n} failed attempts`,
          severity: "high",
        });
      }
    }

    return {
      windowDays: 30,
      reservationsScanned: (resv ?? []).length,
      mpesaScanned: (mpesa ?? []).length,
      flags: flags.slice(0, 100),
    };
  });

/**
 * Occupancy anomaly: compare last-7-day booked nights vs prior-4-week baseline.
 */
export const occupancyAnomaly = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => OrgInput.parse(i))
  .handler(async ({ context }) => {
    const { supabase } = context;
    const today = new Date();
    const start = new Date(today.getTime() - 35 * 86400_000).toISOString().slice(0, 10);

    const { data: resv } = await supabase
      .from("reservations")
      .select("check_in, check_out, status, unit_id")
      .gte("check_in", start)
      .neq("status", "cancelled")
      .limit(5000);

    // Bucket into 7-day windows
    const weekly = [0, 0, 0, 0, 0]; // 4 baseline + current
    for (const r of resv ?? []) {
      const s = new Date(r.check_in);
      const nights = Math.max(
        1,
        Math.round((new Date(r.check_out).getTime() - s.getTime()) / 86400_000),
      );
      const daysAgo = Math.round((today.getTime() - s.getTime()) / 86400_000);
      const bucket = Math.min(4, Math.floor(daysAgo / 7));
      if (bucket >= 0) weekly[bucket] += nights;
    }
    const [current, w1, w2, w3, w4] = weekly;
    const baseline = (w1 + w2 + w3 + w4) / 4;
    const deltaPct = baseline > 0 ? (current - baseline) / baseline : 0;
    const anomaly =
      Math.abs(deltaPct) >= 0.35 ? (deltaPct > 0 ? "spike" : "drop") : "normal";

    return {
      currentWeekNights: current,
      baselineAvgNights: Math.round(baseline * 10) / 10,
      deltaPct: Math.round(deltaPct * 100) / 100,
      classification: anomaly,
    };
  });
