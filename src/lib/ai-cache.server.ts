// Tiny in-memory LRU + TTL cache for AI results. Server-only.
// Cuts latency and cost for repeated prompts (prefill, description, suggest).
// Not distributed — per-worker cache; safe upper bound so we never leak memory.

import { createHash } from "crypto";

type Entry = { value: unknown; expiresAt: number };

const MAX_ENTRIES = 500;
const store = new Map<string, Entry>();

export function cacheKey(namespace: string, payload: unknown): string {
  const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
  const h = createHash("sha1").update(`${namespace}:${raw}`).digest("hex");
  return `${namespace}:${h}`;
}

export function cacheGet<T>(key: string): T | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt < Date.now()) {
    store.delete(key);
    return undefined;
  }
  // LRU touch
  store.delete(key);
  store.set(key, hit);
  return hit.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlSec: number): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
  store.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
}

export async function cached<T>(
  namespace: string,
  payload: unknown,
  ttlSec: number,
  compute: () => Promise<T>,
): Promise<{ value: T; cached: boolean }> {
  const key = cacheKey(namespace, payload);
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return { value: hit, cached: true };
  const value = await compute();
  cacheSet(key, value, ttlSec);
  return { value, cached: false };
}
