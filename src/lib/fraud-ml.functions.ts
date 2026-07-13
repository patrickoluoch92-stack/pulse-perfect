// Admin-only server functions for fraud/anomaly scoring.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requirePlatformRole } from "@/lib/rbac";

export const fraudRiskScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requirePlatformRole(context, ["admin", "super_admin", "moderator"]);
    const { runFraudScan } = await import("@/lib/fraud-ml.server");
    return runFraudScan();
  });

export const marketIntelligenceTick = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requirePlatformRole(context, ["admin", "super_admin"]);
    const { runMarketTick } = await import("@/lib/market-intelligence.server");
    return runMarketTick();
  });
