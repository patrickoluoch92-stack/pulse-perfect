// Cron-callable endpoint for refreshing partner inventory from Booking.com
// and Expedia EPS. Falls back to mock data automatically when credentials
// are absent. Schedule via pg_cron + pg_net (see docs/PARTNER_SYNC.md).
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const DEFAULT_DESTINATIONS = [
  "Nairobi",
  "Mombasa",
  "Diani",
  "Watamu",
  "Naivasha",
  "Maasai Mara",
  "Nanyuki",
  "Kisumu",
  "Amboseli",
  "Lamu",
];

const BodySchema = z
  .object({
    destinations: z.array(z.string().min(2).max(80)).max(30).optional(),
    perDestinationLimit: z.number().int().min(1).max(50).optional(),
  })
  .strict();

export const Route = createFileRoute("/api/public/hooks/partner-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Cron must present a dedicated server-side secret (never shipped to browsers).
        const expected = process.env.PARTNER_SYNC_CRON_SECRET;
        const authHeader = request.headers.get("authorization") ?? "";
        const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
        const provided = bearer ?? request.headers.get("x-cron-secret");
        if (!expected || !provided || provided.length !== expected.length) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        // Timing-safe compare
        const { timingSafeEqual } = await import("crypto");
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        let parsed: z.infer<typeof BodySchema> = {};
        try {
          const text = await request.text();
          parsed = text ? BodySchema.parse(JSON.parse(text)) : {};
        } catch (e) {
          return new Response(
            JSON.stringify({
              error: "Invalid body",
              detail: e instanceof Error ? e.message : String(e),
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        const destinations = parsed.destinations ?? DEFAULT_DESTINATIONS;
        const mod = await import("@/lib/external-inventory.server");
        const result = await mod.syncDestinations({
          destinations,
          perDestinationLimit: parsed.perDestinationLimit ?? 20,
        });
        return new Response(JSON.stringify({ ok: true, ...result }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
