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

    // Ground with HostPulse properties
    const props = await fetchProperties(`${data.module} ${data.prompt}`, data.county);
    const grounding = props
      .map((p: any) => `- ${p.name} (${p.category}) — ${p.town ?? ""}, ${p.county_code ?? ""} [slug: ${p.slug}]`)
      .join("\n");

    const system = `You are HostPulse Planner AI, a Kenyan travel, accommodation, rental, and event planning assistant. Currency: KES. Module: ${data.module} — ${MODULE_HINTS[data.module]}
Always produce a realistic budget breakdown, actionable itinerary items, and clear savings tips. Reference HostPulse properties by slug when relevant. Assume Kenyan cost norms. Keep tone warm, practical, concise.`;

    const userMsg = `User request: ${data.prompt}
${data.county ? `Preferred county: ${data.county}` : ""}
${Object.keys(existingInputs).length ? `Known preferences: ${JSON.stringify(existingInputs).slice(0, 500)}` : ""}

Relevant HostPulse properties:
${grounding || "(none matched — recommend generic categories)"}

Return a complete plan JSON. Set scores 0-100. Use KES amounts.`;

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

    // Enrich recommended properties with lookup rows
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

    return { sessionId, plan, messages, recommendedProperties: recProps };
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

    const system = `You are HostPulse Planner AI. The user is refining an existing ${row.module} plan (KES). Current plan JSON: ${JSON.stringify(row.plan).slice(0, 3000)}. Answer clearly and suggest adjustments.`;
    const answer = await aiChat({
      messages: [{ role: "system", content: system }, ...history.slice(-12)],
    });
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
