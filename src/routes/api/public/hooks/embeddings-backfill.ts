// Cron-triggered backfill of marketplace_properties embeddings.
// Secured by PARTNER_SYNC_CRON_SECRET (same shared secret used by other cron hooks).
import { createFileRoute } from "@tanstack/react-router";
import { runMarketplaceBackfill } from "@/lib/semantic-search.functions";

export const Route = createFileRoute("/api/public/hooks/embeddings-backfill")({
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
          const result = await runMarketplaceBackfill(25, false);
          return Response.json(result);
        } catch (err) {
          const message = err instanceof Error ? err.message : "unknown error";
          return new Response(JSON.stringify({ error: message }), { status: 500 });
        }
      },
    },
  },
});
