// Semantic search — vector embeddings over marketplace_properties.
// Retrieval powers the concierge, guest recommendations, and future engines.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceRateLimit } from "@/lib/rate-limit";
import { aiEmbed, aiEmbedBatch, DEFAULT_EMBED_MODEL } from "@/lib/ai.server";
import { createHash } from "crypto";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Compose the text a property is embedded from. Keep stable so hashes stay meaningful. */
export function composePropertyEmbeddingText(p: {
  name?: string | null;
  category?: string | null;
  parent_category_slug?: string | null;
  child_category_slug?: string | null;
  town?: string | null;
  county_code?: string | null;
  description?: string | null;
  amenities?: string[] | null;
}): string {
  const parts: string[] = [];
  if (p.name) parts.push(p.name);
  const cat = [p.parent_category_slug, p.child_category_slug, p.category].filter(Boolean).join(" / ");
  if (cat) parts.push(`Category: ${cat}`);
  const loc = [p.town, p.county_code].filter(Boolean).join(", ");
  if (loc) parts.push(`Location: ${loc}`);
  if (p.description) parts.push(p.description.slice(0, 2000));
  if (p.amenities?.length) parts.push(`Amenities: ${p.amenities.slice(0, 30).join(", ")}`);
  return parts.join("\n");
}

function hashText(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

// ---------------------------------------------------------------------------
// Public semantic search — no auth needed, safe columns only.
// ---------------------------------------------------------------------------

const SearchInput = z.object({
  query: z.string().min(2).max(500),
  limit: z.number().int().min(1).max(24).default(12),
});

export const semanticSearchProperties = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SearchInput.parse(input))
  .handler(async ({ data }) => {
    const t0 = Date.now();
    let queryVec: number[];
    try {
      queryVec = await aiEmbed(data.query);
    } catch (err) {
      // Fall back to keyword search when embeddings fail (credits/rate limit).
      const supabase = publicClient();
      const { sanitizePostgrestTerm } = await import("@/lib/safe-fetch");
      const q = sanitizePostgrestTerm(data.query, 40);
      const { data: rows } = q
        ? await supabase
            .from("marketplace_properties")
            .select("id, name, slug, town, county_code, category, description")
            .eq("status", "approved")
            .or(`name.ilike.%${q}%,description.ilike.%${q}%,town.ilike.%${q}%`)
            .limit(data.limit)
        : { data: [] as any[] };
      return {
        mode: "keyword" as const,
        latencyMs: Date.now() - t0,
        error: err instanceof Error ? err.message : "embedding failed",
        results: (rows ?? []).map((r: any) => ({ ...r, similarity: null })),
      };
    }
    const supabase = publicClient();
    const { data: rows, error } = await supabase.rpc("match_marketplace_properties", {
      query_embedding: queryVec as any,
      match_count: data.limit,
      only_approved: true,
    });
    if (error) throw new Error(error.message);
    return {
      mode: "vector" as const,
      latencyMs: Date.now() - t0,
      results: (rows ?? []) as any[],
    };
  });

// ---------------------------------------------------------------------------
// Backfill / refresh embeddings. Admin-only.
// ---------------------------------------------------------------------------

const BackfillInput = z.object({
  batchSize: z.number().int().min(1).max(50).default(25),
  force: z.boolean().default(false),
});

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden: admin only");
}

export const backfillMarketplaceEmbeddings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BackfillInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    await enforceRateLimit({ bucket: "embed_backfill", userId: context.userId, limit: 10, windowSec: 60 });
    return runMarketplaceBackfill(data.batchSize, data.force);
  });

/** Callable from cron hooks (with their own auth). Not exported as a server fn. */
export async function runMarketplaceBackfill(batchSize: number, force: boolean) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const query = supabaseAdmin
    .from("marketplace_properties")
    .select(
      "id, name, category, parent_category_slug, child_category_slug, town, county_code, description, amenities, embedding_source_hash",
    )
    .eq("status", "approved")
    .limit(batchSize);
  if (!force) query.is("embedding", null);
  const { data: rows, error } = await query;
  if (error) throw new Error(error.message);
  if (!rows?.length) return { processed: 0, updated: 0, skipped: 0 };

  const texts = rows.map((r: any) => composePropertyEmbeddingText(r));
  const hashes = texts.map(hashText);

  // Skip rows whose source hash already matches (unless force).
  const toEmbed: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (force || (rows[i] as any).embedding_source_hash !== hashes[i]) toEmbed.push(i);
  }
  if (!toEmbed.length) return { processed: rows.length, updated: 0, skipped: rows.length };

  const vecs = await aiEmbedBatch(toEmbed.map((i) => texts[i]));
  let updated = 0;
  for (let k = 0; k < toEmbed.length; k++) {
    const i = toEmbed[k];
    const vec = vecs[k];
    if (!vec) continue;
    const { error: uErr } = await supabaseAdmin
      .from("marketplace_properties")
      .update({
        embedding: vec as any,
        embedding_source_hash: hashes[i],
        embedding_model: DEFAULT_EMBED_MODEL,
        embedding_updated_at: new Date().toISOString(),
      } as any)
      .eq("id", (rows[i] as any).id);
    if (!uErr) updated++;
  }
  return { processed: rows.length, updated, skipped: rows.length - toEmbed.length };
}
