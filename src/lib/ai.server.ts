// Shared server-only AI gateway helper for HostPulse AI engines.
const CHAT_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const EMBED_URL = "https://ai.gateway.lovable.dev/v1/embeddings";

export const DEFAULT_EMBED_MODEL = "google/gemini-embedding-2";
export const EMBED_DIMENSIONS = 3072;

export type AIChatMessage = { role: "system" | "user" | "assistant"; content: string };

function gatewayHeaders(): Record<string, string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI gateway not configured");
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

function surfaceGatewayError(status: number, body: string): never {
  if (status === 429) throw new Error("AI rate limit — please retry in a moment.");
  if (status === 402) throw new Error("AI credits exhausted for this workspace.");
  throw new Error(`AI call failed (${status}): ${body.slice(0, 200)}`);
}

export type AIVisionInput = { url: string } | { base64: string; mime: string };

export async function aiChat(opts: {
  model?: string;
  messages: AIChatMessage[];
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  temperature?: number;
}): Promise<string> {
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
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: gatewayHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) surfaceGatewayError(res.status, await res.text());
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json?.choices?.[0]?.message?.content ?? "";
}

/**
 * Vision-enabled chat call. Passes an image URL or base64 alongside a text prompt
 * using the OpenRouter chat-completions multimodal content-block format.
 */
export async function aiVisionJSON<T>(opts: {
  system: string;
  prompt: string;
  image: AIVisionInput;
  schema: { name: string; schema: Record<string, unknown> };
  model?: string;
}): Promise<T> {
  const imageUrl =
    "url" in opts.image ? opts.image.url : `data:${opts.image.mime};base64,${opts.image.base64}`;
  const body = {
    model: opts.model ?? "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: opts.system },
      {
        role: "user",
        content: [
          { type: "text", text: opts.prompt },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: opts.schema.name, schema: opts.schema.schema, strict: false },
    },
  };
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: gatewayHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) surfaceGatewayError(res.status, await res.text());
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json?.choices?.[0]?.message?.content ?? "";
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error("AI vision returned invalid JSON");
  }
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

/**
 * Generate a single embedding vector. Defaults to google/gemini-embedding-2 (3072-dim).
 * Truncates input at ~7500 chars (safe under the 2048-token cap after tokenization).
 */
export async function aiEmbed(
  text: string,
  model: string = DEFAULT_EMBED_MODEL,
): Promise<number[]> {
  const clean = (text ?? "").trim().slice(0, 7500);
  if (!clean) throw new Error("aiEmbed: empty input");
  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: gatewayHeaders(),
    body: JSON.stringify({ model, input: clean }),
  });
  if (!res.ok) surfaceGatewayError(res.status, await res.text());
  const json = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
  const vec = json?.data?.[0]?.embedding;
  if (!Array.isArray(vec) || vec.length === 0) throw new Error("aiEmbed: empty response");
  return vec;
}

/**
 * Batch embed up to 100 inputs in a single Gemini request. Preserves input order.
 */
export async function aiEmbedBatch(
  texts: string[],
  model: string = DEFAULT_EMBED_MODEL,
): Promise<number[][]> {
  if (!texts.length) return [];
  if (texts.length > 100) throw new Error("aiEmbedBatch: max 100 inputs per call");
  const cleaned = texts.map((t) => (t ?? "").trim().slice(0, 7500) || " ");
  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: gatewayHeaders(),
    body: JSON.stringify({ model, input: cleaned }),
  });
  if (!res.ok) surfaceGatewayError(res.status, await res.text());
  const json = (await res.json()) as { data?: Array<{ index?: number; embedding?: number[] }> };
  const out: number[][] = new Array(cleaned.length);
  for (const row of json?.data ?? []) {
    if (typeof row.index === "number" && Array.isArray(row.embedding))
      out[row.index] = row.embedding;
  }
  return out;
}
