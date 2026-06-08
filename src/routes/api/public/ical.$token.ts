import { createFileRoute } from "@tanstack/react-router";
import { buildICS, type ICSEvent } from "@/lib/ical";

export const Route = createFileRoute("/api/public/ical/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        // Strip optional ".ics" suffix; tokens are 48 hex chars.
        const token = String(params.token ?? "").replace(/\.ics$/i, "");
        if (!/^[a-f0-9]{32,128}$/i.test(token)) {
          return new Response("Not found", { status: 404 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: unit } = await supabaseAdmin
          .from("units")
          .select("id, name, org_id")
          .eq("ical_export_token", token)
          .maybeSingle();
        if (!unit) return new Response("Not found", { status: 404 });

        const [resv, blocks] = await Promise.all([
          supabaseAdmin
            .from("reservations")
            .select("id, check_in, check_out, status")
            .eq("unit_id", unit.id)
            .not("status", "in", "(cancelled,no_show)"),
          supabaseAdmin
            .from("calendar_blocks")
            .select("id, summary, starts_on, ends_on")
            .eq("unit_id", unit.id),
        ]);

        const events: ICSEvent[] = [];
        for (const r of resv.data ?? []) {
          events.push({
            uid: `reservation-${r.id}@hostpulse`,
            summary: "Reserved",
            startsOn: r.check_in,
            endsOn: r.check_out,
          });
        }
        for (const b of blocks.data ?? []) {
          events.push({
            uid: `block-${b.id}@hostpulse`,
            summary: b.summary ?? "Blocked",
            startsOn: b.starts_on,
            endsOn: b.ends_on,
          });
        }

        const body = buildICS({
          prodId: "-//HostPulse//Availability 1.0//EN",
          calName: `HostPulse — ${unit.name}`,
          events,
        });

        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": `inline; filename="${unit.id}.ics"`,
            "Cache-Control": "private, max-age=300",
          },
        });
      },
    },
  },
});
