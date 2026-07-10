// Fraud/Anomaly ML: statistical scoring over recent bookings, payments,
// rate-limit events. Produces per-entity risk scores + top signals.

type Sb = any;
async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as Sb;
}

export interface RiskItem {
  kind: "booking" | "user" | "property";
  id: string;
  score: number; // 0..100
  reasons: string[];
  meta?: Record<string, string | number | null | string[]>;
}


function zscore(x: number, mean: number, std: number) {
  if (std <= 0) return 0;
  return (x - mean) / std;
}

/**
 * Score recent bookings against org/property historical means.
 * Signals: unusually high amount, rapid repeat guest, cancel bursts,
 * mismatched night count vs typical.
 */
export async function scoreRecentBookings(hours = 72, limit = 200): Promise<RiskItem[]> {
  const supabase = await getAdmin();
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();
  const { data: recent } = await supabase
    .from("marketplace_bookings")
    .select("id, property_id, guest_email, guest_phone, total_amount, nights, status, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!recent || recent.length === 0) return [];

  // Historical baselines
  const propIds = Array.from(new Set(recent.map((b: any) => b.property_id).filter(Boolean)));
  const { data: hist } = await supabase
    .from("marketplace_bookings")
    .select("property_id, total_amount, nights")
    .in("property_id", propIds)
    .lt("created_at", since)
    .limit(5000);

  const baseByProp = new Map<string, { amounts: number[]; nights: number[] }>();
  for (const h of hist ?? []) {
    const e = baseByProp.get(h.property_id) ?? { amounts: [], nights: [] };
    if (h.total_amount) e.amounts.push(Number(h.total_amount));
    if (h.nights) e.nights.push(Number(h.nights));
    baseByProp.set(h.property_id, e);
  }
  const stats = (arr: number[]) => {
    if (arr.length < 3) return { mean: 0, std: 0 };
    const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    const v = arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length;
    return { mean: m, std: Math.sqrt(v) };
  };

  // Guest velocity (same email across period)
  const emailCount = new Map<string, number>();
  for (const b of recent) if (b.guest_email) emailCount.set(b.guest_email, (emailCount.get(b.guest_email) ?? 0) + 1);

  const items: RiskItem[] = [];
  for (const b of recent) {
    const reasons: string[] = [];
    let score = 0;
    const base = baseByProp.get(b.property_id) ?? { amounts: [], nights: [] };
    const amt = stats(base.amounts);
    const nts = stats(base.nights);

    if (b.total_amount && amt.std > 0) {
      const z = zscore(Number(b.total_amount), amt.mean, amt.std);
      if (z > 3) {
        score += 40;
        reasons.push(`amount ${z.toFixed(1)}σ above property mean`);
      } else if (z > 2) {
        score += 20;
        reasons.push(`amount ${z.toFixed(1)}σ above property mean`);
      }
    }
    if (b.nights && nts.std > 0) {
      const zn = Math.abs(zscore(Number(b.nights), nts.mean, nts.std));
      if (zn > 3) {
        score += 15;
        reasons.push(`stay length ${zn.toFixed(1)}σ from typical`);
      }
    }
    if (b.guest_email && (emailCount.get(b.guest_email) ?? 0) >= 4) {
      score += 25;
      reasons.push(`guest email has ${emailCount.get(b.guest_email)} recent bookings`);
    }
    if (b.status === "cancelled") {
      score += 10;
      reasons.push("cancelled");
    }
    if (Number(b.total_amount ?? 0) > 500_000) {
      score += 15;
      reasons.push("high absolute value (>KES 500k)");
    }
    if (score > 0) {
      items.push({
        kind: "booking",
        id: b.id,
        score: Math.min(100, score),
        reasons,
        meta: {
          amount: b.total_amount,
          nights: b.nights,
          property_id: b.property_id,
          created_at: b.created_at,
        },
      });
    }
  }

  items.sort((a, b) => b.score - a.score);
  return items.slice(0, 50);
}

/**
 * Score users based on rate-limit event bursts.
 */
export async function scoreThrottledUsers(hours = 24): Promise<RiskItem[]> {
  const supabase = await getAdmin();
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();
  const { data } = await supabase
    .from("rate_limit_events")
    .select("user_id, action, created_at")
    .gte("created_at", since)
    .limit(5000);
  if (!data) return [];
  const byUser = new Map<string, { count: number; actions: Set<string> }>();
  for (const r of data) {
    if (!r.user_id) continue;
    const e = byUser.get(r.user_id) ?? { count: 0, actions: new Set() };
    e.count += 1;
    e.actions.add(r.action ?? "unknown");
    byUser.set(r.user_id, e);
  }
  const out: RiskItem[] = [];
  for (const [uid, e] of byUser) {
    if (e.count < 5) continue;
    const score = Math.min(100, e.count * 5);
    out.push({
      kind: "user",
      id: uid,
      score,
      reasons: [`${e.count} rate-limit hits across ${e.actions.size} actions`],
      meta: { actions: Array.from(e.actions) },
    });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, 30);
}

export async function runFraudScan() {
  const [bookings, users] = await Promise.all([scoreRecentBookings(), scoreThrottledUsers()]);
  return {
    bookings,
    users,
    summary: {
      highRiskBookings: bookings.filter((b) => b.score >= 60).length,
      highRiskUsers: users.filter((u) => u.score >= 60).length,
    },
  };
}
