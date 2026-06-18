/**
 * Daraja STK Push callback.
 * Public URL — Safaricom POSTs here after the user accepts/rejects on their phone.
 *
 * Safaricom does NOT sign callbacks; the only authenticity guard is the
 * unique CheckoutRequestID which we generated server-side. We treat the
 * payload as untrusted: ignore unknown CheckoutRequestIDs, only mark our
 * own pending row, never insert anything new from this endpoint.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _supabase;
}

interface CallbackItem { Name: string; Value?: string | number }
interface Callback {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: { Item: CallbackItem[] };
    };
  };
}

export const Route = createFileRoute("/api/public/mpesa/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: Callback;
        try {
          payload = (await request.json()) as Callback;
        } catch {
          return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
        }
        const cb = payload?.Body?.stkCallback;
        if (!cb?.CheckoutRequestID) {
          return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
        }

        const supabase = getSupabase();
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("id, org_id, plan, status")
          .eq("mpesa_checkout_request_id", cb.CheckoutRequestID)
          .eq("provider", "mpesa")
          .maybeSingle();

        if (!sub) {
          // Unknown CheckoutRequestID — ignore (don't create rows from untrusted input).
          return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
        }

        if (cb.ResultCode === 0) {
          const meta = Object.fromEntries(
            (cb.CallbackMetadata?.Item ?? []).map((i) => [i.Name, i.Value]),
          );
          await supabase
            .from("subscriptions")
            .update({
              status: "active",
              mpesa_receipt_number: (meta.MpesaReceiptNumber as string) ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", sub.id as string);

          // Apply plan to org (30-day access already set by start).
          await supabase
            .from("organizations")
            .update({ plan: sub.plan as string, updated_at: new Date().toISOString() })
            .eq("id", sub.org_id as string);
        } else {
          await supabase
            .from("subscriptions")
            .update({ status: "failed", updated_at: new Date().toISOString() })
            .eq("id", sub.id as string);
        }

        // Daraja expects this exact ack shape.
        return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
      },
    },
  },
});
