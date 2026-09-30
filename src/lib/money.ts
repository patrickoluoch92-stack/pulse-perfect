// Client-safe money + state-machine helpers. Mirrors DB rules in pay_* functions.
// All money is integer minor units (KES cents). Never floats.

export type BookingStatus = "pending" | "paid" | "completed" | "cancelled" | "refunded" | "disputed";

export const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ["paid", "cancelled"],
  paid: ["completed", "cancelled", "disputed"],
  completed: ["disputed", "refunded"],
  disputed: ["paid", "completed", "refunded", "cancelled"],
  cancelled: [],
  refunded: [],
};

export function assertTransition(from: BookingStatus, to: BookingStatus): void {
  if (from === to) return;
  if (!ALLOWED_TRANSITIONS[from].includes(to)) throw new Error(`illegal transition ${from} -> ${to}`);
}

/** Convert a KES decimal (string/number from DB numeric) into integer cents without float drift. */
export function kesToMinor(v: number | string): number {
  const s = String(v).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error(`invalid KES amount: ${s}`);
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

/** M-Pesa only moves whole shillings. */
export function minorToWholeKes(minor: number): number {
  if (minor % 100 !== 0) throw new Error("M-Pesa amounts must be whole shillings");
  return minor / 100;
}

export function splitCommission(amountMinor: number, bps: number) {
  const commission = Math.floor((amountMinor * bps) / 10000);
  return { commission, providerShare: amountMinor - commission };
}

/** Proportional reversal after completion (matches pay_cancel_or_refund). */
export function refundSplit(amountMinor: number, bps: number, refundMinor: number, returnsCommission: boolean) {
  if (refundMinor < 0 || refundMinor > amountMinor) throw new Error("invalid refund amount");
  const { providerShare } = splitCommission(amountMinor, bps);
  if (returnsCommission) {
    const provider = Math.floor((providerShare * refundMinor) / amountMinor);
    return { provider, commission: refundMinor - provider };
  }
  if (refundMinor > providerShare) throw new Error("refund exceeds provider share");
  return { provider: refundMinor, commission: 0 };
}

export function isBalanced(entries: { dir: "D" | "C"; amount: number }[]): boolean {
  let d = 0;
  let c = 0;
  for (const e of entries) {
    if (!Number.isInteger(e.amount) || e.amount < 0) return false;
    if (e.dir === "D") d += e.amount;
    else c += e.amount;
  }
  return d === c && d > 0;
}

export function maskMsisdn(m: string): string {
  const d = m.replace(/\D+/g, "");
  return d.length < 6 ? "***" : `${d.slice(0, 5)}****${d.slice(-3)}`;
}
