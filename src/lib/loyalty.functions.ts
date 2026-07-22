// Loyalty points server functions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function tierFor(lifetime: number): string {
  if (lifetime >= 10000) return "platinum";
  if (lifetime >= 5000) return "gold";
  if (lifetime >= 1500) return "silver";
  return "bronze";
}

export const getLoyalty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: account } = await supabase
      .from("loyalty_accounts")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    const { data: ledger } = await supabase
      .from("loyalty_ledger")
      .select("id, delta, reason, reference_type, reference_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return {
      account: account ?? {
        user_id: userId,
        points_balance: 0,
        tier: "bronze",
        lifetime_points: 0,
      },
      ledger: ledger ?? [],
    };
  });

/**
 * Award loyalty points (admin-callable or via privileged flows).
 * Called from booking confirmation, review submission, etc.
 */
export const awardPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        delta: z.number().int(),
        reason: z.string().min(1).max(200),
        referenceType: z.string().optional(),
        referenceId: z.string().uuid().optional(),
        targetUserId: z.string().uuid().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Only allow awarding to self, unless caller is admin
    let target = userId;
    if (data.targetUserId && data.targetUserId !== userId) {
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin" as any,
      });
      if (!isAdmin) throw new Error("Forbidden");
      target = data.targetUserId;
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Load or create the account
    const { data: existing } = await supabaseAdmin
      .from("loyalty_accounts")
      .select("*")
      .eq("user_id", target)
      .maybeSingle();

    const currentBalance = existing?.points_balance ?? 0;
    const currentLifetime = existing?.lifetime_points ?? 0;
    const newBalance = currentBalance + data.delta;
    const newLifetime = data.delta > 0 ? currentLifetime + data.delta : currentLifetime;
    const newTier = tierFor(newLifetime);

    if (existing) {
      await supabaseAdmin
        .from("loyalty_accounts")
        .update({ points_balance: newBalance, lifetime_points: newLifetime, tier: newTier })
        .eq("user_id", target);
    } else {
      await supabaseAdmin.from("loyalty_accounts").insert({
        user_id: target,
        points_balance: newBalance,
        lifetime_points: newLifetime,
        tier: newTier,
      });
    }

    await supabaseAdmin.from("loyalty_ledger").insert({
      user_id: target,
      delta: data.delta,
      reason: data.reason,
      reference_type: data.referenceType ?? null,
      reference_id: data.referenceId ?? null,
    });

    return { balance: newBalance, lifetime: newLifetime, tier: newTier };
  });
