// Ops Automation: cron-driven housekeeping/maintenance/subscription tasks.
// Server-only, invoked by /api/public/hooks/ops-tick.

type Sb = any;
async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as Sb;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * Auto-create a "Turnover cleaning" housekeeping task for every marketplace
 * booking checking out tomorrow, if one doesn't already exist.
 */
export async function autoCreateTurnoverTasks() {
  const supabase = await getAdmin();
  const tomorrow = isoDate(new Date(Date.now() + 86400_000));

  const { data: bookings } = await supabase
    .from("marketplace_bookings")
    .select("id, property_id, check_out, status")
    .eq("check_out", tomorrow)
    .eq("status", "confirmed");
  if (!bookings || bookings.length === 0) return { created: 0 };

  const propIds = Array.from(new Set(bookings.map((b: any) => b.property_id).filter(Boolean)));
  const { data: props } = await supabase
    .from("marketplace_properties")
    .select("id, owner_id, title")
    .in("id", propIds);
  const orgByProp = new Map<string, { org_id: string | null; title: string }>();
  for (const p of props ?? []) {
    // Owner-to-org mapping via organization_members
    orgByProp.set(p.id, { org_id: null, title: p.title });
  }
  const ownerIds = Array.from(new Set((props ?? []).map((p: any) => p.owner_id).filter(Boolean)));
  if (ownerIds.length > 0) {
    const { data: memberships } = await supabase
      .from("organization_members")
      .select("user_id, org_id")
      .in("user_id", ownerIds);
    const orgByOwner = new Map<string, string>();
    for (const m of memberships ?? []) if (!orgByOwner.has(m.user_id)) orgByOwner.set(m.user_id, m.org_id);
    for (const p of props ?? []) {
      const org = orgByOwner.get(p.owner_id);
      if (org) orgByProp.set(p.id, { org_id: org, title: p.title });
    }
  }

  // Check existing tasks to avoid duplicates
  const { data: existing } = await supabase
    .from("housekeeping_tasks")
    .select("property_id, scheduled_for, title")
    .eq("scheduled_for", tomorrow);
  const existingKey = new Set(
    (existing ?? [])
      .filter((r: any) => (r.title ?? "").startsWith("Turnover cleaning"))
      .map((r: any) => `${r.property_id}::${r.scheduled_for}`),
  );

  const rows = bookings
    .map((b: any) => {
      const meta = orgByProp.get(b.property_id);
      if (!meta?.org_id) return null;
      const key = `${b.property_id}::${tomorrow}`;
      if (existingKey.has(key)) return null;
      return {
        org_id: meta.org_id,
        property_id: b.property_id,
        title: `Turnover cleaning · ${meta.title}`,
        notes: `Auto-created for booking ${b.id.slice(0, 8)} checking out ${tomorrow}.`,
        scheduled_for: tomorrow,
        priority: "high",
        status: "pending",
      };
    })
    .filter(Boolean);

  if (rows.length === 0) return { created: 0 };
  const { error } = await supabase.from("housekeeping_tasks").insert(rows);
  if (error) throw new Error(error.message);
  return { created: rows.length };
}

/**
 * Escalate maintenance tickets that have been open too long.
 * Rules: >48h open + priority<high => bump to high; >5d open + high => urgent.
 */
export async function escalateStaleMaintenance() {
  const supabase = await getAdmin();
  const now = Date.now();
  const { data: tickets } = await supabase
    .from("maintenance_tickets")
    .select("id, priority, status, created_at")
    .neq("status", "resolved")
    .neq("status", "closed")
    .limit(500);
  if (!tickets) return { escalated: 0 };

  let escalated = 0;
  for (const t of tickets) {
    const ageH = (now - new Date(t.created_at).getTime()) / 3_600_000;
    let next: string | null = null;
    if (ageH >= 120 && t.priority !== "urgent") next = "urgent";
    else if (ageH >= 48 && (t.priority === "low" || t.priority === "normal")) next = "high";
    if (!next) continue;
    const { error } = await supabase
      .from("maintenance_tickets")
      .update({ priority: next })
      .eq("id", t.id);
    if (!error) escalated += 1;
  }
  return { escalated };
}

/**
 * Emit low-balance notices for owner wallets under 500 KES.
 * Writes to subscription_notices (severity=warn).
 */
export async function emitLowWalletNotices() {
  const supabase = await getAdmin();
  const { data: wallets } = await supabase
    .from("owner_wallets")
    .select("owner_id, org_id, balance_amount, currency")
    .lt("balance_amount", 500)
    .limit(200);
  if (!wallets || wallets.length === 0) return { emitted: 0 };

  const rows = wallets.map((w: any) => ({
    org_id: w.org_id,
    notice_type: "low_wallet_balance",
    payload: {
      balance: Number(w.balance_amount),
      currency: w.currency ?? "KES",
      owner_id: w.owner_id,
    },
  }));
  const { error } = await supabase.from("subscription_notices").insert(rows);
  if (error) throw new Error(error.message);
  return { emitted: rows.length };
}

export async function runOpsTick() {
  const [turnover, escalations, wallets] = await Promise.all([
    autoCreateTurnoverTasks().catch((e) => ({ created: 0, error: String(e) })),
    escalateStaleMaintenance().catch((e) => ({ escalated: 0, error: String(e) })),
    emitLowWalletNotices().catch((e) => ({ emitted: 0, error: String(e) })),
  ]);
  return { turnover, escalations, wallets };
}
