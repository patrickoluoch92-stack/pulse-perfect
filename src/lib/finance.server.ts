// Core finance logic: commission resolution, wallet ledger writes, and the
// accrue/settle/reverse state machine. Used by both the createServerFn wrappers
// in finance.functions.ts and by the booking-status hook in
// marketplace-extra.functions.ts. Server-only (imports supabaseAdmin).

import type { SupabaseClient } from "@supabase/supabase-js";

type Admin = SupabaseClient<any>;

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function loadAdmin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Admin;
}

export async function resolveWallet(admin: Admin, orgId: string) {
  const { data, error } = await admin
    .from("owner_wallets")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data;
  const { data: created, error: cErr } = await admin
    .from("owner_wallets")
    .insert({ org_id: orgId })
    .select("*")
    .single();
  if (cErr) throw new Error(cErr.message);
  return created;
}

export async function pickCommissionRule(
  admin: Admin,
  opts: {
    orgId: string;
    propertyId: string;
    category: string | null;
    countyCode: string | null;
  },
) {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("commission_rules")
    .select("*")
    .eq("active", true)
    .lte("effective_from", now)
    .order("priority", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []).filter(
    (r: any) => !r.effective_to || new Date(r.effective_to) > new Date(),
  );
  const order = [
    ["property", opts.propertyId],
    ["org", opts.orgId],
    ["category", opts.category],
    ["county", opts.countyCode],
    ["global", null],
  ] as const;
  for (const [scope, value] of order) {
    if (scope === "global") {
      const g = rows.find((r: any) => r.scope === "global");
      if (g) return g;
    } else if (value) {
      const m = rows.find((r: any) => r.scope === scope && r.scope_value === String(value));
      if (m) return m;
    }
  }
  return null;
}

export async function getActiveTaxRate(admin: Admin, code: string): Promise<number> {
  const { data } = await admin
    .from("platform_tax_rates")
    .select("rate_percent, applies_to, active")
    .eq("code", code)
    .maybeSingle();
  const row = data as any;
  if (!row || !row.active) return 0;
  if (!row.applies_to?.includes("booking")) return 0;
  return Number(row.rate_percent) || 0;
}

export async function writeLedger(
  admin: Admin,
  opts: {
    walletId: string;
    orgId: string;
    entryType: "credit" | "debit";
    category: string;
    amount: number;
    targetBucket: "available" | "pending";
    movePendingToAvailable?: boolean;
    referenceType?: string;
    referenceId?: string;
    description?: string;
    createdBy?: string;
  },
): Promise<string> {
  const { data: wallet, error: wErr } = await admin
    .from("owner_wallets")
    .select("*")
    .eq("id", opts.walletId)
    .single();
  if (wErr) throw new Error(wErr.message);
  const w = wallet as any;
  let available = Number(w.available_balance);
  let pending = Number(w.pending_balance);
  let lifetimeEarned = Number(w.lifetime_earned);
  let lifetimePaidOut = Number(w.lifetime_paid_out);
  const amt = Number(opts.amount);

  if (opts.movePendingToAvailable) {
    pending = round2(pending - amt);
    available = round2(available + amt);
  } else if (opts.entryType === "credit") {
    if (opts.targetBucket === "pending") pending = round2(pending + amt);
    else available = round2(available + amt);
    if (opts.category === "booking_earnings") lifetimeEarned = round2(lifetimeEarned + amt);
  } else {
    if (opts.targetBucket === "pending") pending = round2(pending - amt);
    else available = round2(available - amt);
    if (opts.category === "payout") lifetimePaidOut = round2(lifetimePaidOut + amt);
  }
  if (available < 0 && opts.category !== "adjustment") {
    throw new Error("Insufficient available balance");
  }

  const { data: entry, error: lErr } = await admin
    .from("wallet_ledger")
    .insert({
      wallet_id: opts.walletId,
      org_id: opts.orgId,
      entry_type: opts.entryType,
      category: opts.category,
      amount: amt,
      available_after: available,
      pending_after: pending,
      reference_type: opts.referenceType ?? null,
      reference_id: opts.referenceId ?? null,
      description: opts.description ?? null,
      created_by: opts.createdBy ?? null,
    })
    .select("id")
    .single();
  if (lErr) throw new Error(lErr.message);

  const { error: uErr } = await admin
    .from("owner_wallets")
    .update({
      available_balance: available,
      pending_balance: pending,
      lifetime_earned: lifetimeEarned,
      lifetime_paid_out: lifetimePaidOut,
    })
    .eq("id", opts.walletId);
  if (uErr) throw new Error(uErr.message);

  return (entry as any).id as string;
}

// ---- State-machine helpers ------------------------------------------------

export async function accrueForBooking(bookingId: string, createdBy?: string) {
  const admin = await loadAdmin();
  const { data: booking, error } = await admin
    .from("marketplace_bookings")
    .select("id, property_id, total_amount, currency, status")
    .eq("id", bookingId)
    .single();
  if (error || !booking) throw new Error("Booking not found");
  const b = booking as any;

  const { data: prop, error: pErr } = await admin
    .from("marketplace_properties")
    .select("id, org_id, category, county_code")
    .eq("id", b.property_id)
    .single();
  if (pErr || !prop) throw new Error("Property not found");
  const p = prop as any;

  const { data: existing } = await admin
    .from("booking_commissions")
    .select("*")
    .eq("booking_id", b.id)
    .maybeSingle();
  if (existing) return { commission: existing, alreadyAccrued: true };

  const gross = Number(b.total_amount) || 0;
  if (gross <= 0) return { commission: null, alreadyAccrued: false, skipped: "no_amount" };

  const rule = await pickCommissionRule(admin, {
    orgId: p.org_id,
    propertyId: p.id,
    category: p.category,
    countyCode: p.county_code,
  });
  const rate = rule ? Number((rule as any).rate_percent) : 10;
  const flat = rule ? Number((rule as any).flat_amount) : 0;
  const commission = round2((gross * rate) / 100 + flat);

  const [vatRate, levyRate, feeRate] = await Promise.all([
    getActiveTaxRate(admin, "vat"),
    getActiveTaxRate(admin, "tourism_levy"),
    getActiveTaxRate(admin, "service_fee"),
  ]);
  const vat = round2((commission * vatRate) / 100);
  const levy = round2((gross * levyRate) / 100);
  const svc = round2((gross * feeRate) / 100);
  const netOwner = round2(gross - commission - vat - levy - svc);

  const wallet = await resolveWallet(admin, p.org_id);
  const ledgerId = await writeLedger(admin, {
    walletId: (wallet as any).id,
    orgId: p.org_id,
    entryType: "credit",
    category: "booking_earnings",
    amount: netOwner,
    targetBucket: "pending",
    referenceType: "booking",
    referenceId: b.id,
    description: `Booking ${b.id.slice(0, 8)} pending settlement`,
    createdBy,
  });

  const { data: comm, error: cErr } = await admin
    .from("booking_commissions")
    .insert({
      booking_id: b.id,
      org_id: p.org_id,
      property_id: p.id,
      gross_amount: gross,
      commission_rate: rate,
      commission_amount: commission,
      vat_amount: vat,
      levy_amount: levy,
      service_fee_amount: svc,
      net_owner_amount: netOwner,
      currency: b.currency ?? "KES",
      rule_id: (rule as any)?.id ?? null,
      status: "pending",
      credited_ledger_id: ledgerId,
    })
    .select("*")
    .single();
  if (cErr) throw new Error(cErr.message);
  return { commission: comm, alreadyAccrued: false };
}

export async function settleForBooking(bookingId: string, createdBy?: string) {
  const admin = await loadAdmin();
  const { data: comm, error } = await admin
    .from("booking_commissions")
    .select("*")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!comm) return { alreadySettled: false, notFound: true };
  const c = comm as any;
  if (c.status !== "pending") return { alreadySettled: true };

  const ledgerId = await writeLedger(admin, {
    walletId: ((await resolveWallet(admin, c.org_id)) as any).id,
    orgId: c.org_id,
    entryType: "credit",
    category: "booking_earnings",
    amount: Number(c.net_owner_amount),
    targetBucket: "available",
    movePendingToAvailable: true,
    referenceType: "booking",
    referenceId: c.booking_id,
    description: `Booking ${c.booking_id.slice(0, 8)} settled`,
    createdBy,
  });
  await admin
    .from("booking_commissions")
    .update({ status: "available", settled_ledger_id: ledgerId })
    .eq("id", c.id);
  return { alreadySettled: false };
}

export async function reverseForBooking(bookingId: string, createdBy?: string) {
  const admin = await loadAdmin();
  const { data: comm, error } = await admin
    .from("booking_commissions")
    .select("*")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!comm) return { notFound: true };
  const c = comm as any;
  if (c.status === "reversed" || c.status === "cancelled") return { alreadyReversed: true };

  const bucket = c.status === "pending" ? "pending" : "available";
  const ledgerId = await writeLedger(admin, {
    walletId: ((await resolveWallet(admin, c.org_id)) as any).id,
    orgId: c.org_id,
    entryType: "debit",
    category: "refund",
    amount: Number(c.net_owner_amount),
    targetBucket: bucket as "available" | "pending",
    referenceType: "booking",
    referenceId: c.booking_id,
    description: `Booking ${c.booking_id.slice(0, 8)} reversed`,
    createdBy,
  });
  await admin
    .from("booking_commissions")
    .update({ status: "reversed", reversed_ledger_id: ledgerId })
    .eq("id", c.id);
  return { ok: true };
}
