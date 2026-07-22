/**
 * Shared formatting helpers. Keep pure & isomorphic (no server-only imports).
 */

export function formatKES(
  value: number | null | undefined,
  opts: { compact?: boolean } = {},
): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "KES 0";
  if (opts.compact && Math.abs(n) >= 1_000) {
    return `KES ${new Intl.NumberFormat("en-KE", { notation: "compact", maximumFractionDigits: 1 }).format(n)}`;
  }
  return `KES ${new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(n)}`;
}

export function formatCurrency(
  value: number | null | undefined,
  currency: string | null | undefined = "KES",
): string {
  const n = Number(value ?? 0);
  const cur = (currency ?? "KES").toUpperCase();
  if (cur === "KES") return formatKES(n);
  try {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${cur} ${n.toLocaleString()}`;
  }
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-KE", { year: "numeric", month: "short", day: "numeric" });
}
