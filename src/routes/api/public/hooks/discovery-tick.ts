// Cron-callable endpoint: crawl one enabled discovery_source per tick.
// Auth: shared `PARTNER_SYNC_CRON_SECRET` via Bearer or x-cron-secret.
import { createFileRoute } from "@tanstack/react-router";

async function checkAuth(request: Request): Promise<Response | null> {
  const expected = process.env.PARTNER_SYNC_CRON_SECRET;
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const provided = bearer ?? request.headers.get("x-cron-secret");
  if (!expected || !provided) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { timingSafeEqual } = await import("crypto");
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}

export const Route = createFileRoute("/api/public/hooks/discovery-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const bad = await checkAuth(request);
        if (bad) return bad;
        const { crawlNextSource } = await import("@/lib/discovery.server");
        const result = await crawlNextSource();
        return new Response(JSON.stringify({ ok: true, ...result }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
