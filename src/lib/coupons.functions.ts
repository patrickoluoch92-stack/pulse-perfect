// Platform-wide coupon management (admin only) + public validation.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Admin role required");
}

// Public: validate a coupon code at checkout (respects RLS: only active + unexpired visible)
export const validateCoupon = createServerFn({ method: "GET" })
  .inputValidator((raw: unknown) =>
    z.object({ code: z.string().min(2).max(60) }).parse(raw),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: row, error } = await (sb as any)
      .from("coupons")
      .select("id, code, description, discount_type, discount_value, currency, starts_at, expires_at, max_redemptions, redemptions_count")
      .eq("code", data.code.trim().toUpperCase())
      .maybeSingle();
    if (error) return { valid: false as const, reason: error.message };
    if (!row) return { valid: false as const, reason: "Unknown code" };
    if (row.starts_at && new Date(row.starts_at) > new Date())
      return { valid: false as const, reason: "Not yet active" };
    if (row.max_redemptions != null && row.redemptions_count >= row.max_redemptions)
      return { valid: false as const, reason: "Redemption limit reached" };
    return { valid: true as const, coupon: row };
  });

export const adminListCoupons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await (context.supabase as any)
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

export const adminUpsertCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        code: z.string().min(2).max(60),
        description: z.string().max(500).optional(),
        discountType: z.enum(["percent", "fixed"]),
        discountValue: z.number().positive().max(100000),
        currency: z.string().length(3).default("KES"),
        maxRedemptions: z.number().int().positive().optional(),
        startsAt: z.string().optional(),
        expiresAt: z.string().optional(),
        active: z.boolean().default(true),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const payload = {
      code: data.code.trim().toUpperCase(),
      description: data.description ?? null,
      discount_type: data.discountType,
      discount_value: data.discountValue,
      currency: data.currency,
      max_redemptions: data.maxRedemptions ?? null,
      starts_at: data.startsAt ?? null,
      expires_at: data.expiresAt ?? null,
      active: data.active,
      created_by: context.userId,
    };
    if (data.id) {
      const { error } = await (context.supabase as any)
        .from("coupons")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await (context.supabase as any)
      .from("coupons")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const adminDeleteCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await (context.supabase as any)
      .from("coupons")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
