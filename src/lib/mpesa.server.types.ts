/**
 * Client-safe re-export of MPESA price constants only.
 * (mpesa.server.ts is server-only — it reads process.env at module scope.)
 */
export const MPESA_PLAN_PRICES: Record<"professional" | "business", number> = {
  professional: 6500,
  business: 19500,
};
