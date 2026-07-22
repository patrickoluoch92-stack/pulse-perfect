// Deterministic property verification checks (no AI calls, sub-ms).
// Produces a quality report used by the intelligence dashboard, admin
// review queue, and the onboarding assistant's "publish readiness" gate.

export type VerificationRow = {
  id?: string;
  name?: string | null;
  description?: string | null;
  category?: string | null;
  county_code?: string | null;
  town?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  price_per_night?: number | null;
  rent_monthly?: number | null;
  sale_price?: number | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  amenities?: string[] | null;
  main_image_path?: string | null;
  status?: string | null;
  is_verified?: boolean | null;
  listing_intent?: string | null;
};

export type Check = {
  id: string;
  label: string;
  severity: "critical" | "warn" | "info";
  ok: boolean;
  detail?: string;
};

export type VerificationReport = {
  score: number; // 0-100
  publishReady: boolean; // no critical failures
  checks: Check[];
  missing: string[]; // field ids
};

// Kenya latitude/longitude bounds (approx).
const KE_LAT = [-4.75, 5.0];
const KE_LNG = [33.9, 42.0];

function priceOf(p: VerificationRow): number | null {
  return p.price_per_night ?? p.rent_monthly ?? p.sale_price ?? null;
}

export function verifyProperty(p: VerificationRow): VerificationReport {
  const checks: Check[] = [];
  const missing: string[] = [];
  const push = (c: Check) => {
    checks.push(c);
    if (!c.ok && c.severity === "critical") missing.push(c.id);
  };

  push({
    id: "name",
    label: "Property name",
    severity: "critical",
    ok: !!p.name && p.name.trim().length >= 3,
  });
  push({
    id: "description",
    label: "Description ≥ 80 chars",
    severity: "critical",
    ok: !!p.description && p.description.trim().length >= 80,
  });
  push({
    id: "category",
    label: "Category set",
    severity: "critical",
    ok: !!p.category,
  });
  push({
    id: "county",
    label: "County",
    severity: "critical",
    ok: !!p.county_code,
  });
  push({
    id: "town",
    label: "Town / area",
    severity: "warn",
    ok: !!p.town,
  });

  const hasCoords = typeof p.latitude === "number" && typeof p.longitude === "number";
  const inKenya =
    hasCoords &&
    p.latitude! >= KE_LAT[0] &&
    p.latitude! <= KE_LAT[1] &&
    p.longitude! >= KE_LNG[0] &&
    p.longitude! <= KE_LNG[1];
  push({
    id: "coords",
    label: "GPS pin inside Kenya",
    severity: "warn",
    ok: hasCoords ? inKenya : false,
    detail: hasCoords && !inKenya ? "Coordinates outside Kenya bounds" : undefined,
  });

  const price = priceOf(p);
  push({
    id: "price",
    label: "Pricing configured",
    severity: "critical",
    ok: price !== null && price > 0,
  });
  // Sanity: reject absurd nightly rates (KES).
  if (price !== null && p.price_per_night != null) {
    push({
      id: "price_range",
      label: "Nightly price in plausible range (KES 500 – 500k)",
      severity: "warn",
      ok: p.price_per_night >= 500 && p.price_per_night <= 500_000,
    });
  }

  push({
    id: "contact",
    label: "At least one contact channel",
    severity: "warn",
    ok: !!(p.contact_phone || p.contact_email),
  });
  push({
    id: "photo",
    label: "Main image uploaded",
    severity: "warn",
    ok: !!p.main_image_path,
  });
  push({
    id: "amenities",
    label: "3+ amenities listed",
    severity: "info",
    ok: (p.amenities?.length ?? 0) >= 3,
  });

  // Weighted score.
  const weights: Record<Check["severity"], number> = { critical: 15, warn: 8, info: 4 };
  const total = checks.reduce((s, c) => s + weights[c.severity], 0);
  const earned = checks.reduce((s, c) => s + (c.ok ? weights[c.severity] : 0), 0);
  const score = Math.round((earned / total) * 100);

  return {
    score,
    publishReady: missing.length === 0,
    checks,
    missing,
  };
}
