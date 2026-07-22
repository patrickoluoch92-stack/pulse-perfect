import { enforceRateLimit } from "./rate-limit";

/**
 * Throws when the caller's session is not AAL2 (MFA-elevated).
 * Use for destructive or privileged actions (deleting members, revoking
 * tokens, removing webhooks, rotating secrets).
 *
 * `claims` is the JWT payload returned by `requireSupabaseAuth`.
 */
export function requireMfa(claims: Record<string, unknown> | undefined | null): void {
  const aal = (claims?.["aal"] as string | undefined) ?? "aal1";
  if (aal !== "aal2") {
    throw new Error(
      "MFA required: enable two-factor authentication and re-sign-in to perform this action",
    );
  }
}

export function hasMfa(claims: Record<string, unknown> | undefined | null): boolean {
  return (claims?.["aal"] as string | undefined) === "aal2";
}

/**
 * Auth-sensitive rate limit. Defaults: 20 requests per 5 minutes per user
 * per bucket. Tune `limit`/`windowSec` per action when needed.
 */
export async function enforceAuthRateLimit(opts: {
  bucket: string;
  userId: string;
  key?: string;
  limit?: number;
  windowSec?: number;
}): Promise<void> {
  await enforceRateLimit({
    bucket: `auth:${opts.bucket}`,
    userId: opts.userId,
    key: opts.key,
    limit: opts.limit ?? 20,
    windowSec: opts.windowSec ?? 300,
  });
}
