// Server-only SSRF-safe fetch helpers.
//
// Blocks requests to private/link-local/loopback addresses (including cloud
// metadata endpoints) and caps response size. Use for any server-side fetch
// whose target URL is derived from untrusted org/user input.

const PRIVATE_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /\.local$/i,
  /\.internal$/i,
];

// IPv4 ranges: 10/8, 127/8, 169.254/16, 172.16/12, 192.168/16, 100.64/10, 0.0.0.0
function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local + AWS/GCP metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIPv6(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "::1" || h === "::" ) return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // ULA
  if (h.startsWith("fe80")) return true; // link-local
  return false;
}

export function isPublicHttpUrl(rawUrl: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let u: URL;
  try { u = new URL(rawUrl); } catch { return { ok: false, reason: "invalid URL" }; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, reason: "unsupported protocol" };
  const host = u.hostname;
  if (!host) return { ok: false, reason: "missing host" };
  if (PRIVATE_HOST_PATTERNS.some((r) => r.test(host))) return { ok: false, reason: "private host" };
  if (isPrivateIPv4(host)) return { ok: false, reason: "private IP" };
  if (host.includes(":") && isPrivateIPv6(host)) return { ok: false, reason: "private IPv6" };
  return { ok: true, url: u };
}

export type SafeFetchOptions = {
  maxBytes?: number;      // default 5 MB
  timeoutMs?: number;     // default 15s
  maxRedirects?: number;  // default 3
  headers?: Record<string, string>;
};

/**
 * Fetch a URL that came from user/org input with SSRF and size guards.
 * - Rejects non-http(s), private/link-local, loopback, and cloud-metadata hosts.
 * - Manually follows redirects (each hop re-validated).
 * - Caps response body size.
 */
export async function safeFetchText(rawUrl: string, opts: SafeFetchOptions = {}): Promise<string> {
  const maxBytes = opts.maxBytes ?? 5 * 1024 * 1024;
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const maxRedirects = opts.maxRedirects ?? 3;

  let current = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const check = isPublicHttpUrl(current);
    if (!check.ok) throw new Error(`Blocked URL: ${check.reason}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(check.url.toString(), {
        method: "GET",
        redirect: "manual",
        headers: opts.headers,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("Redirect without Location header");
      current = new URL(loc, check.url).toString();
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // Enforce Content-Length up front when present.
    const cl = Number(res.headers.get("content-length") ?? "0");
    if (cl && cl > maxBytes) throw new Error("Response too large");

    const reader = res.body?.getReader();
    if (!reader) return (await res.text()).slice(0, maxBytes);

    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        try { await reader.cancel(); } catch { /* ignore */ }
        throw new Error("Response too large");
      }
      chunks.push(value);
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(concatChunks(chunks, total));
  }
  throw new Error("Too many redirects");
}

function concatChunks(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.byteLength; }
  return out;
}

/**
 * Escape a substring intended to be interpolated into a PostgREST `.or()`
 * or `.filter()` value. PostgREST treats `,()."` and similar characters as
 * structural syntax inside filter expressions, so untrusted text must be
 * stripped before being concatenated into a filter string.
 *
 * We conservatively drop these characters (rather than backslash-escape,
 * which PostgREST doesn't uniformly honor). Callers typically wrap the
 * result in `%...%` for `ilike`.
 */
export function sanitizePostgrestTerm(input: string, max = 80): string {
  return String(input)
    .replace(/[,()."'*\\]/g, " ")
    .replace(/[%_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}
