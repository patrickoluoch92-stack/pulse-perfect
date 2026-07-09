// Cron-invoked endpoint. Sends renewal reminders and expires past-due subs.
// Called from pg_cron via net.http_post with the anon apikey.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/subscription-renewals")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.PARTNER_SYNC_CRON_SECRET;
        const authHeader = request.headers.get("authorization") ?? "";
        const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
        const provided = bearer ?? request.headers.get("x-cron-secret");
        if (!expected || !provided) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }
        const { timingSafeEqual } = await import("crypto");
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const now = new Date();
          const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          const in1 = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

          const { data: subs } = await (supabaseAdmin as any)
            .from("subscriptions")
            .select("id, org_id, plan, status, current_period_end, cancel_at_period_end")
            .eq("status", "active");

          const results: Record<string, number> = { renewal_7d: 0, renewal_1d: 0, expired: 0 };
          for (const s of (subs ?? []) as any[]) {
            const end = s.current_period_end ? new Date(s.current_period_end) : null;
            if (!end) continue;
            if (end < now) {
              // Expire
              await (supabaseAdmin as any).from("subscriptions").update({ status: "expired" }).eq("id", s.id);
              await (supabaseAdmin as any).from("subscription_events").insert({
                subscription_id: s.id, org_id: s.org_id, event_type: "expired", from_plan: s.plan,
              });
              if (s.cancel_at_period_end) {
                await (supabaseAdmin as any).from("organizations").update({ plan: "starter" }).eq("id", s.org_id);
              }
              results.expired++;
              continue;
            }
            const notice =
              end <= in1 ? "renewal_1d" :
              end <= in7 ? "renewal_7d" : null;
            if (!notice) continue;
            // Idempotent insert; unique(subscription_id, notice_type) prevents dupes.
            const { error } = await (supabaseAdmin as any)
              .from("subscription_notices")
              .insert({ subscription_id: s.id, notice_type: notice });
            if (!error) {
              await (supabaseAdmin as any).from("subscription_events").insert({
                subscription_id: s.id, org_id: s.org_id, event_type: "reminder_sent",
                payload: { notice },
              });
              results[notice]++;
            }
          }
          return Response.json({ ok: true, results });
        } catch (e: any) {
          return new Response(`Renewal sweep failed: ${e.message}`, { status: 500 });
        }
      },
    },
  },
});
