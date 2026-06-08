// Shared plan capability matrix. Used by route guards and UI.
export type Plan = "starter" | "professional" | "business" | "enterprise";

export const PLAN_RANK: Record<Plan, number> = {
  starter: 0,
  professional: 1,
  business: 2,
  enterprise: 3,
};

export const PLAN_LABEL: Record<Plan, string> = {
  starter: "Starter",
  professional: "Professional",
  business: "Business",
  enterprise: "Enterprise",
};

export type Feature =
  | "analytics.basic"
  | "analytics.advanced"
  | "analytics.range.90d"
  | "analytics.range.ytd"
  | "analytics.property_breakdown";

// Minimum plan required for each feature.
export const FEATURE_MIN_PLAN: Record<Feature, Plan> = {
  "analytics.basic": "professional",
  "analytics.advanced": "business",
  "analytics.range.90d": "professional",
  "analytics.range.ytd": "business",
  "analytics.property_breakdown": "business",
};

export function planAllows(plan: Plan | null | undefined, feature: Feature): boolean {
  if (!plan) return false;
  return PLAN_RANK[plan] >= PLAN_RANK[FEATURE_MIN_PLAN[feature]];
}

export function requiredPlanFor(feature: Feature): Plan {
  return FEATURE_MIN_PLAN[feature];
}
