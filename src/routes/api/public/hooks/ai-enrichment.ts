// Cron-triggered AI enrichment: image vision tagging + review NLP.
// Secured by PARTNER_SYNC_CRON_SECRET.
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

export const Route = createFileRoute("/api/public/hooks/ai-enrichment")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await verify(request))) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }
        try {
          const [{ runVisionTick, runReviewNlpTick }, { runSeoGenTick }] = await Promise.all([
            import("@/lib/enrichment-tick.server"),
            import("@/lib/seo-gen.server"),
          ]);
          const vision = await runVisionTick(10);
          const reviews = await runReviewNlpTick(20);
          const seo = await runSeoGenTick(10);
          return Response.json({ vision, reviews, seo });

        } catch (err) {
          const message = err instanceof Error ? err.message : "unknown error";
          return new Response(JSON.stringify({ error: message }), { status: 500 });
        }
      },
    },
  },
});
