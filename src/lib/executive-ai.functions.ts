// AI-generated executive summary + narrative over the executive KPI payload.
// Admin-only; layered on top of `getExecutiveOverview`.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isPlatformAdmin } from "@/lib/access";
import { aiJSON } from "@/lib/ai.server";

interface ExecInsight {
  headline: string;
  wins: string[];
  risks: string[];
  actions: string[];
}

export const generateExecutiveSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ExecInsight> => {
    const { supabase, userId } = context;
    const admin = await isPlatformAdmin(supabase, userId);
    if (!admin) throw new Error("Forbidden: platform admin required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = supabaseAdmin as any;

    // Compact KPI snapshot (avoid shipping raw rows to the LLM).
    const since30 = new Date(Date.now() - 30 * 86400_000).toISOString();
    const [propsRes, bookingsRes, commissionsRes, walletsRes, discoveredRes] = await Promise.all([
      s.from("marketplace_properties").select("id, is_published, verification_status"),
      s
        .from("marketplace_bookings")
        .select("id, total_amount, status, created_at")
        .gte("created_at", since30),
      s
        .from("booking_commissions")
        .select("commission_amount, status, created_at")
        .gte("created_at", since30),
      s.from("owner_wallets").select("available_balance, pending_balance"),
      s.from("discovered_properties").select("id, status"),
    ]);

    const props = propsRes.data ?? [];
    const bookings = bookingsRes.data ?? [];
    const commissions = commissionsRes.data ?? [];
    const wallets = walletsRes.data ?? [];
    const discovered = discoveredRes.data ?? [];

    const kpi = {
      properties: {
        total: props.length,
        published: props.filter((p: any) => p.is_published).length,
        verified: props.filter((p: any) => p.verification_status === "verified").length,
      },
      bookings30d: {
        total: bookings.length,
        confirmed: bookings.filter((b: any) => b.status === "confirmed").length,
        cancelled: bookings.filter((b: any) => b.status === "cancelled").length,
        gmv: bookings.reduce((a: number, b: any) => a + Number(b.total_amount ?? 0), 0),
      },
      revenue30d: {
        commission: commissions.reduce(
          (a: number, c: any) => a + Number(c.commission_amount ?? 0),
          0,
        ),
      },
      wallets: {
        available: wallets.reduce((a: number, w: any) => a + Number(w.available_balance ?? 0), 0),
        pending: wallets.reduce((a: number, w: any) => a + Number(w.pending_balance ?? 0), 0),
      },
      discovery: {
        total: discovered.length,
        pending: discovered.filter((d: any) => d.status === "pending").length,
        ready: discovered.filter((d: any) => d.status === "ready").length,
      },
    };

    const system = `You are the chief strategy analyst for HostPulse, a Kenyan travel + property marketplace.
Produce an executive summary in JSON:
{
  "headline": string (one sentence, <=140 chars),
  "wins": string[] (2-4 bullets, factual, no hype),
  "risks": string[] (2-4 bullets),
  "actions": string[] (2-4 concrete next steps, prioritized)
}
Use KES for currency. Be specific with numbers. Avoid generic advice.`;

    return aiJSON<ExecInsight>({
      system,
      user: JSON.stringify(kpi),
      model: "openai/gpt-5.5",
      schema: {
        name: "exec_summary",
        schema: {
          type: "object",
          properties: {
            headline: { type: "string" },
            wins: { type: "array", items: { type: "string" } },
            risks: { type: "array", items: { type: "string" } },
            actions: { type: "array", items: { type: "string" } },
          },
          required: ["headline", "wins", "risks", "actions"],
        },
      },
    });
  });
