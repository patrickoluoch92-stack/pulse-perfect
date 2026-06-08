import { createFileRoute } from "@tanstack/react-router";
import { buildICS, type ICSEvent } from "@/lib/ical";

const SECURITY_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};

function clientIp(req: Request): string | null {
  const h = req.headers;
  return (
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    (h.get("x-forwarded-for")?.split(",")[0].trim() ?? null)
  );
}

export const Route = createFileRoute("/api/public/ical/$token")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const raw = String(params.token ?? "").replace(/\.ics$/i, "");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const ua = request.headers.get("user-agent")?.slice(0, 300) ?? null;
        const ip = clientIp(request);

        const log = (
          status: string,
          unit: { id?: string; org_id?: string } | null,
        ) =>
          supabaseAdmin
            .from("ical_access_log")
            .insert({
              org_id: unit?.org_id ?? null,
              unit_id: unit?.id ?? null,
              token_prefix: raw.slice(0, 8),
              status,
              ip,
              user_agent: ua,
            })
            .then(() => undefined, () => undefined);

        // Strict format check before any DB lookup.
        if (!/^[a-f0-9]{32,128}$/.test(raw)) {
          await log("invalid_format", null);
          return new Response("Not found", { status: 404, headers: SECURITY_HEADERS });
        }

        // Only GET / HEAD permitted (handler is GET; HEAD handled by runtime).
        if (request.method !== "GET" && request.method !== "HEAD") {
          return new Response("Method not allowed", {
            status: 405,
            headers: { ...SECURITY_HEADERS, Allow: "GET, HEAD" },
          });
        }

        const { data: unit } = await supabaseAdmin
          .from("units")
          .select("id, name, org_id, ical_export_token_expires_at")
          .eq("ical_export_token", raw)
          .maybeSingle();

        if (!unit) {
          await log("not_found", null);
          return new Response("Not found", { status: 404, headers: SECURITY_HEADERS });
        }

        if (
          unit.ical_export_token_expires_at &&
          new Date(unit.ical_export_token_expires_at).getTime() < Date.now()
        ) {
          await log("expired", unit);
          return new Response("Token expired", { status: 410, headers: SECURITY_HEADERS });
        }

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

        await log("ok", unit);

        return new Response(body, {
          status: 200,
          headers: {
            ...SECURITY_HEADERS,
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": `inline; filename="${unit.id}.ics"`,
          },
        });
      },
    },
  },
});
