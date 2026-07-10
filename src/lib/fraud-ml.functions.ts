// Admin-only server functions for fraud/anomaly scoring.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data: isAdmin } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin" as any,
  });
  if (!isAdmin) throw new Error("Forbidden");
}

export const fraudRiskScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { runFraudScan } = await import("@/lib/fraud-ml.server");
    return runFraudScan();
  });

export const marketIntelligenceTick = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { runMarketTick } = await import("@/lib/market-intelligence.server");
    return runMarketTick();
  });
