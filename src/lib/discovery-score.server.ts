// Deterministic quality scorer (0-100) for a discovered property row.
// Higher = more complete + verifiable. Used by admin queues and public sort.

export type DiscoveredLike = {
  name?: string | null;
  property_type?: string | null;
  county_code?: string | null;
  town?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  amenities?: string[] | null;
  ai_description?: string | null;
  status?: string | null;
  promoted_property_id?: string | null;
};

export function computeQualityScore(p: DiscoveredLike): number {
  let s = 0;
  if (p.name && p.name.length >= 3) s += 10;
  if (p.property_type) s += 8;
  if (p.county_code) s += 6;
  if (p.town) s += 4;
  if (p.address) s += 6;
  if (typeof p.latitude === "number" && typeof p.longitude === "number") s += 10;
  if (p.phone) s += 10;
  if (p.email) s += 6;
  if (p.website) s += 8;
  if ((p.amenities?.length ?? 0) >= 3) s += 6;
  if ((p.ai_description?.length ?? 0) >= 120) s += 8;
  if (p.status === "claimed") s += 10;
  if (p.promoted_property_id) s += 8;
  return Math.min(100, s);
}
