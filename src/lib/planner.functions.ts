// HostPulse Planner AI — conversational budget & itinerary planner.
// Reuses existing AI gateway, recommendations, and property index.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { aiJSON, aiChat, aiEmbed, type AIChatMessage } from "@/lib/ai.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PLANNER_MODULES = [
  "rental", "travel", "stay", "event", "business",
  "family", "honeymoon", "student", "weekend", "general",
] as const;
export type PlannerModule = (typeof PLANNER_MODULES)[number];

const MODULE_HINTS: Record<PlannerModule, string> = {
  rental: "Long-term rental planning — monthly rent, utilities, commute, neighbourhood fit, family size.",
  travel: "Multi-day trip — accommodation, transport, meals, activities, itinerary, packing.",
  stay: "Short/medium accommodation — hotels, apartments, guest houses for defined dates.",
  event: "Event planning — venue, catering, decor, accommodation for guests, timeline.",
  business: "Business travel — hotels near venue, transport, meeting spaces, expense estimate.",
  family: "Family vacation — kid-friendly stays, activities, safety, daily schedule.",
  honeymoon: "Romantic getaway — luxury stays, couple experiences, personalised itinerary.",
  student: "Student accommodation — budget, safety, proximity to institution, commute.",
  weekend: "Weekend/road trip — destination, fuel, quick itinerary, packing list.",
  general: "Open-ended planning conversation.",
};

function publicSb() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

// ---------- Grounding: fetch relevant HostPulse properties ----------
async function fetchProperties(query: string, county?: string, limit = 6) {
  const sb = publicSb();
  try {
    const vec = await aiEmbed(query);
    const { data } = await sb.rpc("match_marketplace_properties", {
      query_embedding: vec as any,
      match_count: limit * 2,
      only_approved: true,
    });
    const rows = (data ?? []) as any[];
    const filtered = county
      ? rows.filter((r) => (r.county_code ?? "").toLowerCase().includes(county.toLowerCase()))
      : rows;
    if (filtered.length) return filtered.slice(0, limit);
  } catch { /* fall through */ }
  const { data } = await sb
    .from("marketplace_properties")
    .select("id,name,slug,town,county_code,category,description")
    .eq("status", "approved")
    .limit(limit);
  return data ?? [];
}

// ---------- Schemas ----------
const PlanSchema = {
  name: "planner_plan",
  schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      currency: { type: "string" },
      totalBudget: { type: "number" },
      allocations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: { type: "string" },
            amount: { type: "number" },
            note: { type: "string" },
          },
        },
      },
      itinerary: {
        type: "array",
        items: {
          type: "object",
          properties: {
            day: { type: "string" },
            items: { type: "array", items: { type: "string" } },
          },
        },
      },
      recommendedProperties: { type: "array", items: { type: "string" } },
      recommendedVehicles: { type: "array", items: { type: "string" } },
      savingsTips: { type: "array", items: { type: "string" } },
      alternatives: { type: "array", items: { type: "string" } },
      scores: {
        type: "object",
        properties: {
          budgetFit: { type: "number" },
          valueScore: { type: "number" },
          affordability: { type: "number" },
        },
      },
      packingList: { type: "array", items: { type: "string" } },
      warnings: { type: "array", items: { type: "string" } },
    },
    required: ["title", "summary", "allocations"],
  },
};

// ---------- Generate/refine plan ----------
const GenerateInput = z.object({
  sessionId: z.string().uuid().optional(),
  module: z.enum(PLANNER_MODULES),
  prompt: z.string().min(3).max(4000),
  county: z.string().max(80).optional(),
});

export const generatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => GenerateInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Load prior messages if session exists
    let messages: Array<{ role: "user" | "assistant"; content: string }> = [];
    let existingInputs: Record<string, unknown> = {};
    if (data.sessionId) {
      const { data: row } = await supabase
        .from("planner_sessions")
        .select("messages, inputs")
        .eq("id", data.sessionId)
        .maybeSingle();
      if (row) {
        messages = (row.messages as any) ?? [];
        existingInputs = (row.inputs as any) ?? {};
      }
    }

    messages.push({ role: "user", content: data.prompt });

    // Ground with HostPulse properties + mobility vehicles
    const { fetchMobilityForPlan } = await import("@/lib/mobility.functions");
    const [props, vehicles] = await Promise.all([
      fetchProperties(`${data.module} ${data.prompt}`, data.county),
      fetchMobilityForPlan(`${data.module} ${data.prompt}`, data.county, 4).catch(() => []),
    ]);
    const grounding = props
      .map((p: any) => `- ${p.name} (${p.category}) — ${p.town ?? ""}, ${p.county_code ?? ""} [slug: ${p.slug}]`)
      .join("\n");
    const vehicleGrounding = (vehicles as any[])
      .map((v) => `- ${v.make} ${v.model} (${v.category}, ${v.seats ?? "?"} seats) — ${v.town ?? ""}, ${v.county_code ?? ""} [slug: ${v.slug}]`)
      .join("\n");

    const system = `You are HostPulse Planner AI, a Kenyan travel, accommodation, rental, mobility, and event planning assistant. Currency: KES. Module: ${data.module} — ${MODULE_HINTS[data.module]}
Always produce a realistic budget breakdown, actionable itinerary items, and clear savings tips. Reference HostPulse properties AND vehicles by slug when relevant. Include transport in every travel/safari/wedding/business/weekend plan. Assume Kenyan cost norms. Keep tone warm, practical, concise.`;

    const userMsg = `User request: ${data.prompt}
${data.county ? `Preferred county: ${data.county}` : ""}
${Object.keys(existingInputs).length ? `Known preferences: ${JSON.stringify(existingInputs).slice(0, 500)}` : ""}

Relevant HostPulse properties:
${grounding || "(none matched — recommend generic categories)"}

Available HostPulse mobility (car hire / transport):
${vehicleGrounding || "(none matched — suggest generic categories: self-drive, chauffeur, airport transfer, safari 4x4, shuttle)"}

Return a complete plan JSON. Populate recommendedVehicles with vehicle slugs when a trip needs transport. Set scores 0-100. Use KES amounts.`;

    const plan = await aiJSON<any>({
      system,
      user: userMsg,
      schema: PlanSchema,
    });

    const assistantText = plan.summary || "Plan ready.";
    messages.push({ role: "assistant", content: assistantText });

    // Upsert session
    let sessionId = data.sessionId;
    if (sessionId) {
      await supabase
        .from("planner_sessions")
        .update({ plan, messages, module: data.module, title: plan.title ?? null })
        .eq("id", sessionId);
    } else {
      const { data: ins, error } = await supabase
        .from("planner_sessions")
        .insert({
          user_id: userId,
          module: data.module,
          title: plan.title ?? data.prompt.slice(0, 80),
          inputs: { prompt: data.prompt, county: data.county ?? null },
          plan,
          messages,
          status: "draft",
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      sessionId = ins!.id;
    }

    // Enrich recommended properties + vehicles
    const slugs: string[] = Array.isArray(plan.recommendedProperties)
      ? plan.recommendedProperties.slice(0, 10)
      : [];
    let recProps: any[] = [];
    if (slugs.length) {
      const { data: rows } = await publicSb()
        .from("marketplace_properties")
        .select("id,name,slug,town,county_code,category")
        .in("slug", slugs);
      recProps = rows ?? [];
    }

    const vehicleSlugs: string[] = Array.isArray(plan.recommendedVehicles)
      ? plan.recommendedVehicles.slice(0, 8)
      : [];
    let recVehicles: any[] = [];
    if (vehicleSlugs.length) {
      const { data: rows } = await (publicSb() as any)
        .from("mobility_vehicles")
        .select("id, slug, make, model, category, seats, transmission, town, county_code")
        .in("slug", vehicleSlugs);
      recVehicles = rows ?? [];
    }

    return { sessionId, plan, messages, recommendedProperties: recProps, recommendedVehicles: recVehicles };
  });

// ---------- Chat continuation (free-form Q&A on a plan) ----------
const ChatInput = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1).max(2000),
});

export const chatOnPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => ChatInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("planner_sessions")
      .select("messages, plan, module")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (error || !row) throw new Error("Session not found");
    const history = ((row.messages as any) ?? []) as AIChatMessage[];
    history.push({ role: "user", content: data.message });

    const system = `You are HostPulse Planner AI. The user is refining an existing ${row.module} plan (KES). Current plan JSON: ${JSON.stringify(row.plan).slice(0, 3000)}. Answer clearly and suggest adjustments. Keep replies concise (under 200 words).`;
    let answer = "";
    try {
      answer = await aiChat({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: system }, ...history.slice(-12)],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI call failed";
      throw new Error(msg);
    }
    if (!answer || !answer.trim()) {
      answer = "I couldn't generate a reply just now — please rephrase or try again in a moment.";
    }
    history.push({ role: "assistant", content: answer });
    await supabase.from("planner_sessions").update({ messages: history }).eq("id", data.sessionId);
    return { answer, messages: history };
  });

// ---------- List / get sessions ----------
export const listPlannerSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("planner_sessions")
      .select("id, module, title, status, updated_at")
      .order("updated_at", { ascending: false })
      .limit(50);
    return { sessions: data ?? [] };
  });

const GetInput = z.object({ id: z.string().uuid() });
export const getPlannerSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => GetInput.parse(v))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("planner_sessions")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    return { session: row };
  });

const DelInput = z.object({ id: z.string().uuid() });
export const deletePlannerSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => DelInput.parse(v))
  .handler(async ({ data, context }) => {
    await context.supabase.from("planner_sessions").delete().eq("id", data.id);
    return { ok: true };
  });
