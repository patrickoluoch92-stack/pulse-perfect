import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { verifyWebhook, EventName, planFromProductExternalId, type PaddleEnv } from "@/lib/paddle.server";

let _supabase: SupabaseClient<Database> | null = null;
function getSupabase(): SupabaseClient<Database> {
  if (!_supabase) {
    _supabase = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _supabase;
}

/** Sync organization.plan from current Paddle subscription state. */
async function applyPlanToOrg(orgId: string, plan: "starter" | "professional" | "business") {
  await getSupabase().from("organizations").update({ plan, updated_at: new Date().toISOString() }).eq("id", orgId);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionCreated(data: any, env: PaddleEnv) {
  const { id, customerId, items, status, currentBillingPeriod, customData, scheduledChange } = data;
  const userId = customData?.userId as string | undefined;
  const orgId = customData?.orgId as string | undefined;
  if (!userId || !orgId) {
    console.error("paddle webhook: missing userId/orgId in customData");
    return;
  }
  const item = items[0];
  const priceExternal = item.price.importMeta?.externalId as string | undefined;
  const productExternal = item.product.importMeta?.externalId as string | undefined;
  if (!priceExternal || !productExternal) {
    console.warn("paddle webhook: missing importMeta.externalId — skipping");
    return;
  }
  const plan = planFromProductExternalId(productExternal);
  if (!plan) {
    console.warn("paddle webhook: unknown product", productExternal);
    return;
  }
  await getSupabase().from("subscriptions").upsert(
    {
      user_id: userId,
      org_id: orgId,
      provider: "paddle",
      plan,
      paddle_subscription_id: id,
      paddle_customer_id: customerId,
      paddle_price_id: priceExternal,
      status,
      current_period_start: currentBillingPeriod?.startsAt,
      current_period_end: currentBillingPeriod?.endsAt,
      cancel_at_period_end: scheduledChange?.action === "cancel",
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "paddle_subscription_id" },
  );
  if (status === "active" || status === "trialing") await applyPlanToOrg(orgId, plan);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionUpdated(data: any, env: PaddleEnv) {
  const { id, status, currentBillingPeriod, scheduledChange, items } = data;
  const item = items?.[0];
  const productExternal = item?.product?.importMeta?.externalId as string | undefined;
  const priceExternal = item?.price?.importMeta?.externalId as string | undefined;
  const plan = productExternal ? planFromProductExternalId(productExternal) : null;

  const { data: row } = await getSupabase()
    .from("subscriptions")
    .update({
      status,
      ...(plan ? { plan } : {}),
      ...(priceExternal ? { paddle_price_id: priceExternal } : {}),
      current_period_start: currentBillingPeriod?.startsAt,
      current_period_end: currentBillingPeriod?.endsAt,
      cancel_at_period_end: scheduledChange?.action === "cancel",
      updated_at: new Date().toISOString(),
    })
    .eq("paddle_subscription_id", id)
    .eq("environment", env)
    .select("org_id, plan")
    .maybeSingle();

  if (row?.org_id) {
    if (status === "active" || status === "trialing") {
      await applyPlanToOrg(row.org_id as string, (plan ?? row.plan) as "professional" | "business");
    }
    // past_due → keep access; don't downgrade. Paddle retries.
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  const { data: row } = await getSupabase()
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("paddle_subscription_id", data.id)
    .eq("environment", env)
    .select("org_id, current_period_end")
    .maybeSingle();
  // Access continues until current_period_end; a scheduled task / next-write
  // downgrades when the period actually ends. We do NOT downgrade here.
  void row;
}

async function handleWebhook(req: Request, env: PaddleEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.eventType) {
    case EventName.SubscriptionCreated:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await handleSubscriptionCreated(event.data as any, env);
      break;
    case EventName.SubscriptionUpdated:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await handleSubscriptionUpdated(event.data as any, env);
      break;
    case EventName.SubscriptionCanceled:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await handleSubscriptionCanceled(event.data as any, env);
      break;
    default:
      console.log("paddle webhook unhandled:", event.eventType);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Derive the Paddle environment server-side ONLY. Never trust the
        // request URL — an attacker who knows the sandbox webhook secret
        // could otherwise forge subscription events against production by
        // POSTing with ?env=sandbox.
        const env: PaddleEnv = process.env.PADDLE_ENV === "live" ? "live" : "sandbox";
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("paddle webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
