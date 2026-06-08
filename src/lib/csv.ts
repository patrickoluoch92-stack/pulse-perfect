/**
 * CSV utilities hardened against:
 *  - Formula injection (Excel/Sheets): leading =, +, -, @, tab, CR are prefixed with '
 *  - Field overflow: values are truncated at MAX_FIELD bytes
 *  - Embedded delimiters / quotes / newlines: quoted + doubled
 */
const MAX_FIELD = 32_768;
const RISKY_LEADER = /^[=+\-@\t\r]/;
const NEEDS_QUOTING = /[",\n\r]/;

export function escapeCsvField(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (s.length > MAX_FIELD) s = s.slice(0, MAX_FIELD);
  if (RISKY_LEADER.test(s)) s = "'" + s;
  return NEEDS_QUOTING.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(header: string[], rows: unknown[][]): string {
  const head = header.map(escapeCsvField).join(",");
  const body = rows.map((r) => r.map(escapeCsvField).join(",")).join("\n");
  // UTF-8 BOM so Excel detects encoding correctly.
  return "\uFEFF" + head + "\n" + body;
}

/**
 * Simple sliding-window rate limiter, keyed by an arbitrary string (e.g. userId).
 * Throws when the limit is exceeded. Pure in-memory; per-instance only.
 */
export function makeRateLimiter(maxPerWindow: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return function assert(key: string, now: number = Date.now()): void {
    const cutoff = now - windowMs;
    const arr = (hits.get(key) ?? []).filter((t) => t > cutoff);
    if (arr.length >= maxPerWindow) {
      throw new Error("Too many requests — please wait a moment and try again");
    }
    arr.push(now);
    hits.set(key, arr);
  };
}
