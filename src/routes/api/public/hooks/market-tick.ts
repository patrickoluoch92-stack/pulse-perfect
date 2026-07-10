// Cron-triggered market intelligence tick: recomputes regional demand
// and competitor rate signals. Secured by PARTNER_SYNC_CRON_SECRET.
import { createFileRoute } from "@tanstack/react-router";

async function verify(request: Request): Promise<boolean> {
  const expected = process.env.PARTNER_SYNC_CRON_SECRET;
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const provided = bearer ?? request.headers.get("x-cron-secret");
  if (!expected || !provided) return false;
  const { timingSafeEqual } = await import("crypto");
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/hooks/market-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await verify(request))) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }
        try {
          const { runMarketTick } = await import("@/lib/market-intelligence.server");
          const result = await runMarketTick();
          return Response.json(result);
        } catch (err) {
          const message = err instanceof Error ? err.message : "unknown error";
          return new Response(JSON.stringify({ error: message }), { status: 500 });
        }
      },
    },
  },
});
