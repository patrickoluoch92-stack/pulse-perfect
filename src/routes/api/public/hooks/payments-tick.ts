// Cron: ?job=stuck (every few minutes) | payouts (daily) | reconcile (daily, optional settlement lines in body)
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Settlement = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lines: z.array(z.object({
    receipt: z.string().min(4).max(40),
    direction: z.enum(["in", "out"]),
    amount_minor: z.number().int().nonnegative(),
    balance_minor: z.number().int().optional(),
  })).max(20000).default([]),
});

export const Route = createFileRoute("/api/public/hooks/payments-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const s = await import("@/lib/pay-ledger.server");
        if (!(await s.verifyCronSecret(request))) return new Response("Unauthorized", { status: 401 });
        const job = new URL(request.url).searchParams.get("job");
        try {
          if (job === "stuck") {
            const a = await s.checkStuckPayments();
            const b = await s.reprocessWebhooks();
            return Response.json({ ...a, ...b });
          }
          if (job === "payouts") return Response.json(await s.runPayouts());
          if (job === "reconcile") {
            const body = Settlement.parse(await request.json().catch(() => ({ date: new Date(Date.now() - 86400000).toISOString().slice(0, 10) })));
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const db = supabaseAdmin as any;
            if (body.lines.length) {
              await db.from("pay_settlement_lines").upsert(
                body.lines.map((l) => ({ ...l, statement_date: body.date })),
                { onConflict: "receipt", ignoreDuplicates: true },
              );
            }
            const { data, error } = await db.rpc("pay_reconcile", { _date: body.date });
            if (error) throw new Error(error.message);
            if (data?.breaks > 0) s.log("reconciliation_alert", { date: body.date, ...data });
            return Response.json(data);
          }
          return new Response("Unknown job", { status: 400 });
        } catch (e) {
          s.log("tick_error", { job, err: String(e) });
          return new Response("Job failed", { status: 500 });
        }
      },
    },
  },
});
