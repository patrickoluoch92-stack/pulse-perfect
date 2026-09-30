import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  Result: z.object({ OriginatorConversationID: z.string().max(100), ResultCode: z.union([z.number(), z.string()]) }).passthrough(),
});

export const Route = createFileRoute("/api/public/mpesa/b2c-result/$token")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const s = await import("@/lib/pay-ledger.server");
        if (!(await s.verifyCallbackToken(params.token))) return new Response("Forbidden", { status: 403 });
        const json = await request.json().catch(() => null);
        const parsed = Body.safeParse(json);
        if (!parsed.success) return new Response("Bad payload", { status: 400 });
        const id = await s.recordWebhook("b2c_result", parsed.data.Result.OriginatorConversationID, json);
        if (id) await s.processB2CEvent(id, json, false);
        return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
      },
    },
  },
});
