import { createFileRoute } from "@tanstack/react-router";

// Public web-vitals collector. Best-effort: logs structured metric for ops
// dashboards (Cloudflare/Lovable logs). No DB write to keep ingest cheap.
export const Route = createFileRoute("/api/public/web-vitals")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const payload = await request.json().catch(() => null);
          if (payload && typeof payload === "object") {
            // eslint-disable-next-line no-console
            console.log("[web-vitals]", JSON.stringify(payload));
          }
        } catch {
          /* swallow */
        }
        return new Response(null, { status: 204 });
      },
      OPTIONS: () => new Response(null, { status: 204 }),
    },
  },
});
