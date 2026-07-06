// Shared server-only AI gateway helper for HostPulse AI engines.
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type AIChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function aiChat(opts: {
  model?: string;
  messages: AIChatMessage[];
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  temperature?: number;
}): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI gateway not configured");
  const body: Record<string, unknown> = {
    model: opts.model ?? "openai/gpt-5.5",
    messages: opts.messages,
  };
  if (opts.jsonSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: opts.jsonSchema.name, schema: opts.jsonSchema.schema, strict: false },
    };
  }
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 429) throw new Error("AI rate limit — please retry in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
    throw new Error(`AI call failed (${res.status}): ${t.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json?.choices?.[0]?.message?.content ?? "";
}

export async function aiJSON<T>(opts: {
  system: string;
  user: string;
  schema: { name: string; schema: Record<string, unknown> };
  model?: string;
}): Promise<T> {
  const content = await aiChat({
    model: opts.model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    jsonSchema: opts.schema,
  });
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error("AI returned invalid JSON");
  }
}
