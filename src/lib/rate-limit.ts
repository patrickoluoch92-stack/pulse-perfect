import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Generic sliding-window rate limiter backed by `rate_limit_events`.
 *
 * Throws an Error with HTTP 429-style message when the limit is exceeded.
 * Records the event on success.
 */
export async function enforceRateLimit(opts: {
  bucket: string;
  userId: string;
  /** Max events per window. */
  limit: number;
  /** Window length in seconds. */
  windowSec: number;
  /** Optional sub-key (e.g. resource id) to bucket per-resource. */
  key?: string;
}): Promise<void> {
  const since = new Date(Date.now() - opts.windowSec * 1000).toISOString();
  let q = supabaseAdmin
    .from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("bucket", opts.bucket)
    .eq("user_id", opts.userId)
    .gte("created_at", since);
  if (opts.key) q = q.eq("key", opts.key);

  const { count, error } = await q;
  if (error) throw new Error(error.message);

  if ((count ?? 0) >= opts.limit) {
    throw new Error(
      `Rate limit exceeded: ${opts.limit} per ${opts.windowSec}s for ${opts.bucket}`,
    );
  }

  await supabaseAdmin.from("rate_limit_events").insert({
    bucket: opts.bucket,
    user_id: opts.userId,
    key: opts.key ?? null,
  });
}

/** Best-effort cleanup of old rate-limit rows (call from a cron route). */
export async function pruneRateLimitEvents(olderThanSec = 24 * 60 * 60): Promise<void> {
  const cutoff = new Date(Date.now() - olderThanSec * 1000).toISOString();
  await supabaseAdmin.from("rate_limit_events").delete().lt("created_at", cutoff);
}
