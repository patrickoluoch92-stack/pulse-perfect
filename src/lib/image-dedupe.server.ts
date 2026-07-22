// Content-hash based image dedupe for discovered listings.
// True perceptual hashing (pHash) requires native image decoding which is
// unavailable in Workers; we use a SHA-256 of the bytes as an exact-dup
// fingerprint, which catches the common re-upload/scrape case.
import { createHash } from "crypto";

export async function hashImageUrl(url: string, timeoutMs = 5000): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength === 0) return null;
    return createHash("sha256").update(buf).digest("hex");
  } catch {
    return null;
  }
}

/**
 * Index image fingerprints for a discovered property. Returns matches against
 * existing marketplace properties (exact byte-level duplicates).
 */
export async function indexImagesForDiscovered(
  supabaseAdmin: any,
  discoveredId: string,
  urls: string[],
): Promise<{
  hashed: number;
  matches: Array<{ url: string; phash: string; matchedPropertyId: string }>;
}> {
  const uniqueUrls = Array.from(new Set(urls)).slice(0, 8);
  let hashed = 0;
  const matches: Array<{ url: string; phash: string; matchedPropertyId: string }> = [];

  for (const url of uniqueUrls) {
    const phash = await hashImageUrl(url);
    if (!phash) continue;
    hashed++;

    // Check for a prior match against an existing marketplace property.
    const { data: prior } = await supabaseAdmin
      .from("discovery_image_hashes")
      .select("property_id, discovered_property_id")
      .eq("phash", phash)
      .not("property_id", "is", null)
      .limit(1);
    if (prior?.[0]?.property_id) {
      matches.push({ url, phash, matchedPropertyId: prior[0].property_id });
    }

    await supabaseAdmin.from("discovery_image_hashes").insert({
      discovered_property_id: discoveredId,
      image_url: url,
      phash,
    });
  }

  return { hashed, matches };
}
