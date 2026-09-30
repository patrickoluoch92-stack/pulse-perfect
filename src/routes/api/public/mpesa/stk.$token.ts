import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  Body: z.object({
    stkCallback: z.object({
      MerchantRequestID: z.string().max(100),
      CheckoutRequestID: z.string().max(100),
      ResultCode: z.union([z.number(), z.string()]),
      ResultDesc: z.string().max(500).optional(),
    }).passthrough(),
  }),
});

export const Route = createFileRoute("/api/public/mpesa/stk/$token")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const s = await import("@/lib/pay-ledger.server");
        if (!(await s.verifyCallbackToken(params.token))) return new Response("Forbidden", { status: 403 });
        const json = await request.json().catch(() => null);
        const parsed = Body.safeParse(json);
        if (!parsed.success) return new Response("Bad payload", { status: 400 });
        const id = await s.recordWebhook("stk", parsed.data.Body.stkCallback.CheckoutRequestID, json);
        if (id) await s.processStkEvent(id, json); // failures are retried by the stuck-payments job
        return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
      },
    },
  },
});
