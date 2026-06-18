import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gatewayFetch, getPaddleClient, type PaddleEnv } from "@/lib/paddle.server";

export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .inputValidator((data: { priceId: string; environment: PaddleEnv }) => data)
  .handler(async ({ data }) => {
    const response = await gatewayFetch(
      data.environment,
      `/prices?external_id=${encodeURIComponent(data.priceId)}`,
    );
    const result = await response.json();
    if (!result.data?.length) throw new Error(`Price not found: ${data.priceId}`);
    return result.data[0].id as string;
  });

export const createCustomerPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: sub, error } = await supabase
      .from("subscriptions")
      .select("provider, paddle_subscription_id, paddle_customer_id, environment")
      .eq("user_id", userId)
      .eq("provider", "paddle")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sub?.paddle_customer_id || !sub?.paddle_subscription_id) {
      throw new Error("No active Paddle subscription to manage.");
    }
    const paddle = getPaddleClient(sub.environment as PaddleEnv);
    const session = await paddle.customerPortalSessions.create(sub.paddle_customer_id, [
      sub.paddle_subscription_id,
    ]);
    return { url: session.urls.general.overview };
  });
