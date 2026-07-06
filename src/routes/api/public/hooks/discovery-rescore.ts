// Cron-callable endpoint: nightly rescore + dedupe sweep.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/discovery-rescore")({
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
        const { rescoreAllPending } = await import("@/lib/discovery.server");
        const result = await rescoreAllPending();
        return new Response(JSON.stringify({ ok: true, ...result }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
