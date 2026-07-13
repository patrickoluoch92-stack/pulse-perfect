// Central Role-Based Access Control helpers used by server functions.
// Everything here is server-only (runs inside a server-fn handler that already
// authenticated the caller via requireSupabaseAuth) and uses the authenticated
// Supabase client so RLS is enforced end-to-end.

export type AppRole = "super_admin" | "admin" | "moderator" | "support" | "user";
export type OrgRole = "owner" | "enterprise_admin" | "admin" | "manager" | "staff" | "guest";
export type Permission =
  | "bookings.read"
  | "bookings.write"
  | "bookings.refund"
  | "pricing.write"
  | "availability.write"
  | "reviews.moderate"
  | "finance.read"
  | "finance.payout"
  | "marketing.write"
  | "guests.pii.read"
  | "team.invite"
  | "reports.read";

export const PLATFORM_ROLES: AppRole[] = ["super_admin", "admin", "moderator", "support", "user"];
export const ORG_ROLES: OrgRole[] = ["owner", "enterprise_admin", "admin", "manager", "staff", "guest"];

export class ForbiddenError extends Error {
  status = 403;
  constructor(reason: string) {
    super(`Forbidden: ${reason}`);
    this.name = "ForbiddenError";
  }
}

type Ctx = { supabase: any; userId: string };

/** True if the caller holds any of the given platform roles.
 *  `admin` implicitly satisfies checks for `super_admin` (back-compat during transition). */
export async function hasPlatformRole(ctx: Ctx, roles: readonly AppRole[]): Promise<boolean> {
  const wanted = new Set<string>(roles);
  // admin implies super_admin for back-compat
  if (wanted.has("super_admin")) wanted.add("admin");
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .in("role", Array.from(wanted));
  return Array.isArray(data) && data.length > 0;
}

export async function requirePlatformRole(ctx: Ctx, roles: readonly AppRole[]): Promise<void> {
  if (!(await hasPlatformRole(ctx, roles))) {
    throw new ForbiddenError(`requires platform role in [${roles.join(", ")}]`);
  }
}

export async function hasOrgRole(ctx: Ctx, orgId: string, roles: readonly OrgRole[]): Promise<boolean> {
  const { data } = await ctx.supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("org_id", orgId)
    .in("role", roles as unknown as string[])
    .maybeSingle();
  return Boolean(data);
}

export async function requireOrgRole(ctx: Ctx, orgId: string, roles: readonly OrgRole[]): Promise<void> {
  // Platform admins bypass org role checks.
  if (await hasPlatformRole(ctx, ["admin", "super_admin"])) return;
  if (!(await hasOrgRole(ctx, orgId, roles))) {
    throw new ForbiddenError(`requires org role in [${roles.join(", ")}] on ${orgId}`);
  }
}

/** Resolves a fine-grained permission via the has_permission SECURITY DEFINER function. */
export async function hasPermission(ctx: Ctx, orgId: string, permission: Permission): Promise<boolean> {
  const { data, error } = await ctx.supabase.rpc("has_permission", {
    _user_id: ctx.userId,
    _org_id: orgId,
    _permission: permission,
  });
  if (error) return false;
  return data === true;
}

export async function requirePermission(ctx: Ctx, orgId: string, permission: Permission): Promise<void> {
  if (!(await hasPermission(ctx, orgId, permission))) {
    throw new ForbiddenError(`missing permission ${permission}`);
  }
}

export async function isPlatformAdmin(ctx: Ctx): Promise<boolean> {
  return hasPlatformRole(ctx, ["admin", "super_admin"]);
}
