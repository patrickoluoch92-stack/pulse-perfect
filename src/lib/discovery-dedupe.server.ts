// Deduplication helpers for discovered properties.
// - normalizePhone / normalizeDomain: canonical forms for matching
// - fingerprint: coarse content hash used as first-pass filter
// - haversineKm: GPS distance

import { createHash } from "crypto";

export function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  // Kenya: strip leading 0/254
  if (digits.startsWith("254")) return "+" + digits;
  if (digits.startsWith("0") && digits.length === 10) return "+254" + digits.slice(1);
  return "+" + digits;
}

export function normalizeDomain(url?: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function normalizeName(name?: string | null): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/\b(the|hotel|lodge|resort|guest\s*house|villa|apartments?|camp|inn|suites?)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function fingerprint(p: {
  name?: string | null;
  county_code?: string | null;
  phone?: string | null;
  website?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): string {
  const parts = [
    normalizeName(p.name),
    (p.county_code ?? "").toLowerCase(),
    normalizePhone(p.phone) ?? "",
    normalizeDomain(p.website) ?? "",
    typeof p.latitude === "number" ? p.latitude.toFixed(3) : "",
    typeof p.longitude === "number" ? p.longitude.toFixed(3) : "",
  ].join("|");
  return createHash("sha256").update(parts).digest("hex").slice(0, 32);
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function slugify(name: string, suffix?: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return suffix ? `${base}-${suffix}` : base;
}
