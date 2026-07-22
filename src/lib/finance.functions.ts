// Phase 1 monetization: server functions for commissions, wallets, ledger, payouts,
// tax rates. Core logic lives in finance.server.ts so booking-status hooks can
// call the same code path without going through the createServerFn RPC boundary.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isPlatformAdmin, hasOrgRole } from "@/lib/access";

async function loadAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function assertAdmin(sb: any, userId: string) {
  if (!(await isPlatformAdmin(sb, userId))) throw new Error("Admin role required");
}

// ---------- commission state machine (wrappers) ---------------------------

export const accrueBookingCommission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ bookingId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const admin = await loadAdmin();
    const { data: prop } = await admin
      .from("marketplace_bookings")
      .select("property_id, marketplace_properties!inner(org_id)")
      .eq("id", data.bookingId)
      .single();
    const orgId = (prop as any)?.marketplace_properties?.org_id;
    const isAdmin = await isPlatformAdmin(context.supabase, context.userId);
    const authorized =
      isAdmin ||
      (orgId &&
        (await hasOrgRole(context.supabase, context.userId, orgId, ["owner", "admin", "manager"])));
    if (!authorized) throw new Error("Forbidden");
    const { accrueForBooking } = await import("@/lib/finance.server");
    return accrueForBooking(data.bookingId, context.userId);
  });

export const settleBookingCommission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ bookingId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const admin = await loadAdmin();
    const { data: comm } = await admin
      .from("booking_commissions")
      .select("org_id")
      .eq("booking_id", data.bookingId)
      .maybeSingle();
    const isAdmin = await isPlatformAdmin(context.supabase, context.userId);
    const authorized =
      isAdmin ||
      ((comm as any)?.org_id &&
        (await hasOrgRole(context.supabase, context.userId, (comm as any).org_id, [
          "owner",
          "admin",
          "manager",
        ])));
    if (!authorized) throw new Error("Forbidden");
    const { settleForBooking } = await import("@/lib/finance.server");
    return settleForBooking(data.bookingId, context.userId);
  });

export const reverseBookingCommission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ bookingId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const admin = await loadAdmin();
    const { data: comm } = await admin
      .from("booking_commissions")
      .select("org_id")
      .eq("booking_id", data.bookingId)
      .maybeSingle();
    const isAdmin = await isPlatformAdmin(context.supabase, context.userId);
    const authorized =
      isAdmin ||
      ((comm as any)?.org_id &&
        (await hasOrgRole(context.supabase, context.userId, (comm as any).org_id, [
          "owner",
          "admin",
          "manager",
        ])));
    if (!authorized) throw new Error("Forbidden");
    const { reverseForBooking } = await import("@/lib/finance.server");
    return reverseForBooking(data.bookingId, context.userId);
  });

// ---------- owner wallet reads --------------------------------------------

export const getWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ orgId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const isMember = await hasOrgRole(context.supabase, context.userId, data.orgId, [
      "owner",
      "admin",
      "manager",
      "member",
    ]);
    if (!isMember && !(await isPlatformAdmin(context.supabase, context.userId)))
      throw new Error("Forbidden");
    const admin = await loadAdmin();
    const { resolveWallet } = await import("@/lib/finance.server");
    return resolveWallet(admin, data.orgId);
  });

export const listWalletLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({ orgId: z.string().uuid(), limit: z.number().int().min(1).max(200).default(50) })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const isMember = await hasOrgRole(context.supabase, context.userId, data.orgId, [
      "owner",
      "admin",
      "manager",
      "member",
    ]);
    if (!isMember && !(await isPlatformAdmin(context.supabase, context.userId)))
      throw new Error("Forbidden");
    const { data: rows, error } = await context.supabase
      .from("wallet_ledger")
      .select("*")
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const updatePayoutDestination = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        method: z.enum(["mpesa", "bank"]),
        destination: z.record(z.string().max(200)),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const ok = await hasOrgRole(context.supabase, context.userId, data.orgId, ["owner", "admin"]);
    if (!ok) throw new Error("Only workspace owners can update payout details");
    const admin = await loadAdmin();
    const { resolveWallet } = await import("@/lib/finance.server");
    const wallet = await resolveWallet(admin, data.orgId);
    const { error } = await admin
      .from("owner_wallets")
      .update({ payout_method: data.method, payout_destination: data.destination })
      .eq("id", (wallet as any).id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- payouts --------------------------------------------------------

export const requestPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        amount: z.number().positive().max(10_000_000),
        method: z.enum(["mpesa", "bank"]).default("mpesa"),
        destination: z.record(z.string().max(200)).optional(),
        notes: z.string().max(500).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const isOwner = await hasOrgRole(context.supabase, context.userId, data.orgId, [
      "owner",
      "admin",
    ]);
    if (!isOwner) throw new Error("Only workspace owners can request payouts");
    const admin = await loadAdmin();
    const { resolveWallet } = await import("@/lib/finance.server");
    const wallet = await resolveWallet(admin, data.orgId);
    if (Number((wallet as any).available_balance) < data.amount) {
      throw new Error(
        `Available balance is ${(wallet as any).available_balance}, cannot request ${data.amount}`,
      );
    }
    const dest = data.destination ?? (wallet as any).payout_destination ?? {};
    if (data.method === "mpesa" && !dest.phone) throw new Error("M-Pesa phone number required");
    if (data.method === "bank" && !dest.account_number)
      throw new Error("Bank account details required");

    const { data: row, error } = await admin
      .from("payouts")
      .insert({
        org_id: data.orgId,
        wallet_id: (wallet as any).id,
        amount: data.amount,
        currency: (wallet as any).currency,
        method: data.method,
        destination: dest,
        status: "requested",
        requested_by: context.userId,
        notes: data.notes ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, payout: row };
  });

export const listMyPayouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ orgId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const isMember = await hasOrgRole(context.supabase, context.userId, data.orgId, [
      "owner",
      "admin",
      "manager",
      "member",
    ]);
    if (!isMember && !(await isPlatformAdmin(context.supabase, context.userId)))
      throw new Error("Forbidden");
    const { data: rows, error } = await context.supabase
      .from("payouts")
      .select("*")
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const cancelPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const admin = await loadAdmin();
    const { data: payout, error } = await admin
      .from("payouts")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !payout) throw new Error("Payout not found");
    const isOwner = await hasOrgRole(context.supabase, context.userId, (payout as any).org_id, [
      "owner",
      "admin",
    ]);
    if (!isOwner) throw new Error("Forbidden");
    if ((payout as any).status !== "requested")
      throw new Error(`Cannot cancel payout in status ${(payout as any).status}`);
    await admin.from("payouts").update({ status: "cancelled" }).eq("id", data.id);
    return { ok: true };
  });

// ---------- admin: commission rules ---------------------------------------

export const adminListCommissionRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("commission_rules")
      .select("*")
      .order("priority", { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

export const adminUpsertCommissionRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(2).max(200),
        scope: z.enum(["global", "county", "category", "property", "org"]),
        scope_value: z.string().max(200).nullable().optional(),
        rate_percent: z.number().min(0).max(100),
        flat_amount: z.number().min(0).default(0),
        priority: z.number().int().min(0).max(10000).default(100),
        active: z.boolean().default(true),
        effective_to: z.string().nullable().optional(),
        notes: z.string().max(500).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const payload = {
      name: data.name,
      scope: data.scope,
      scope_value: data.scope === "global" ? null : (data.scope_value ?? null),
      rate_percent: data.rate_percent,
      flat_amount: data.flat_amount,
      priority: data.priority,
      active: data.active,
      effective_to: data.effective_to ?? null,
      notes: data.notes ?? null,
      created_by: context.userId,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("commission_rules")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("commission_rules")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const adminDeleteCommissionRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("commission_rules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- admin: tax rates ----------------------------------------------

export const adminListTaxRates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("platform_tax_rates")
      .select("*")
      .order("code");
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

export const adminUpsertTaxRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        code: z.string().min(2).max(40),
        name: z.string().min(2).max(200),
        rate_percent: z.number().min(0).max(100),
        applies_to: z.array(z.enum(["booking", "invoice", "subscription"])).min(1),
        active: z.boolean().default(true),
        notes: z.string().max(500).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const payload = {
      code: data.code.toLowerCase(),
      name: data.name,
      rate_percent: data.rate_percent,
      applies_to: data.applies_to,
      active: data.active,
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("platform_tax_rates")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("platform_tax_rates")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

// ---------- admin: payouts queue ------------------------------------------

export const adminListPayouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        status: z
          .enum(["requested", "approved", "processing", "paid", "failed", "cancelled", "all"])
          .default("requested"),
        limit: z.number().int().min(1).max(200).default(100),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("payouts")
      .select("*, organizations(name, slug)")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const adminApprovePayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const admin = await loadAdmin();
    const { data: p, error } = await admin.from("payouts").select("*").eq("id", data.id).single();
    if (error || !p) throw new Error("Payout not found");
    const payout = p as any;
    if (payout.status !== "requested")
      throw new Error(`Cannot approve payout in status ${payout.status}`);

    const { writeLedger } = await import("@/lib/finance.server");
    await writeLedger(admin, {
      walletId: payout.wallet_id,
      orgId: payout.org_id,
      entryType: "debit",
      category: "payout",
      amount: Number(payout.amount),
      targetBucket: "available",
      referenceType: "payout",
      referenceId: payout.id,
      description: `Payout ${payout.id.slice(0, 8)} approved`,
      createdBy: context.userId,
    });
    await admin
      .from("payouts")
      .update({
        status: "approved",
        approved_by: context.userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    return { ok: true };
  });

export const adminMarkPayoutPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ id: z.string().uuid(), reference: z.string().min(2).max(200) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const admin = await loadAdmin();
    const { data: p, error } = await admin.from("payouts").select("*").eq("id", data.id).single();
    if (error || !p) throw new Error("Payout not found");
    const payout = p as any;
    if (!["approved", "processing"].includes(payout.status))
      throw new Error(`Cannot mark paid in status ${payout.status}`);
    await admin
      .from("payouts")
      .update({
        status: "paid",
        processed_at: new Date().toISOString(),
        external_reference: data.reference,
      })
      .eq("id", data.id);
    return { ok: true };
  });

export const adminMarkPayoutFailed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ id: z.string().uuid(), reason: z.string().min(2).max(500) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const admin = await loadAdmin();
    const { data: p, error } = await admin.from("payouts").select("*").eq("id", data.id).single();
    if (error || !p) throw new Error("Payout not found");
    const payout = p as any;
    if (!["approved", "processing"].includes(payout.status))
      throw new Error(`Cannot mark failed in status ${payout.status}`);

    const { writeLedger } = await import("@/lib/finance.server");
    await writeLedger(admin, {
      walletId: payout.wallet_id,
      orgId: payout.org_id,
      entryType: "credit",
      category: "adjustment",
      amount: Number(payout.amount),
      targetBucket: "available",
      referenceType: "payout",
      referenceId: payout.id,
      description: `Payout ${payout.id.slice(0, 8)} failed - refunded`,
      createdBy: context.userId,
    });
    await admin
      .from("payouts")
      .update({
        status: "failed",
        processed_at: new Date().toISOString(),
        failure_reason: data.reason,
      })
      .eq("id", data.id);
    return { ok: true };
  });

// ---------- admin: platform financial overview ----------------------------

export const adminFinancialOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const admin = await loadAdmin();
    const since30 = new Date(Date.now() - 30 * 86400 * 1000).toISOString();

    const [commRes, poutRes, walRes] = await Promise.all([
      admin
        .from("booking_commissions")
        .select(
          "commission_amount, vat_amount, levy_amount, service_fee_amount, gross_amount, created_at, status",
        ),
      admin.from("payouts").select("amount, status, created_at"),
      admin
        .from("owner_wallets")
        .select("available_balance, pending_balance, lifetime_earned, lifetime_paid_out"),
    ]);
    const comm: any[] = commRes.data ?? [];
    const payouts: any[] = poutRes.data ?? [];
    const wallets: any[] = walRes.data ?? [];

    const sum = (arr: any[], key: string) => arr.reduce((s, r) => s + Number(r[key] ?? 0), 0);
    const filter30 = (arr: any[]) => arr.filter((r) => r.created_at >= since30);

    return {
      commissionsAllTime: {
        gross: sum(comm, "gross_amount"),
        commission: sum(comm, "commission_amount"),
        vat: sum(comm, "vat_amount"),
        levy: sum(comm, "levy_amount"),
        service_fee: sum(comm, "service_fee_amount"),
      },
      commissions30d: {
        gross: sum(filter30(comm), "gross_amount"),
        commission: sum(filter30(comm), "commission_amount"),
      },
      payouts: {
        requestedCount: payouts.filter((p) => p.status === "requested").length,
        pendingAmount: sum(
          payouts.filter((p) => ["approved", "processing"].includes(p.status)),
          "amount",
        ),
        paidAllTime: sum(
          payouts.filter((p) => p.status === "paid"),
          "amount",
        ),
        paid30d: sum(filter30(payouts.filter((p) => p.status === "paid")), "amount"),
      },
      wallets: {
        availableTotal: sum(wallets, "available_balance"),
        pendingTotal: sum(wallets, "pending_balance"),
        lifetimeEarned: sum(wallets, "lifetime_earned"),
        lifetimePaidOut: sum(wallets, "lifetime_paid_out"),
      },
    };
  });
