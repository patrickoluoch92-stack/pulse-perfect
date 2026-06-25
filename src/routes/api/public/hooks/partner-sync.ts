// Cron-callable endpoint for refreshing partner inventory from Booking.com
// and Expedia EPS. Falls back to mock data automatically when credentials
// are absent. Schedule via pg_cron + pg_net (see docs/PARTNER_SYNC.md).
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const DEFAULT_DESTINATIONS = [
  "Nairobi", "Mombasa", "Diani", "Watamu", "Naivasha",
  "Maasai Mara", "Nanyuki", "Kisumu", "Amboseli", "Lamu",
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
        // Cron uses Supabase anon apikey header (see docs).
        const apikey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
        if (!apikey || !expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401, headers: { "Content-Type": "application/json" },
          });
        }
        let parsed: z.infer<typeof BodySchema> = {};
        try {
          const text = await request.text();
          parsed = text ? BodySchema.parse(JSON.parse(text)) : {};
        } catch (e) {
          return new Response(
            JSON.stringify({ error: "Invalid body", detail: e instanceof Error ? e.message : String(e) }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        const destinations = parsed.destinations ?? DEFAULT_DESTINATIONS;
        const mod = await import("@/lib/external-inventory.server");
        const result = await mod.syncDestinations({
          destinations,
          perDestinationLimit: parsed.perDestinationLimit ?? 20,
        });
        return new Response(
          JSON.stringify({ ok: true, ...result }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
