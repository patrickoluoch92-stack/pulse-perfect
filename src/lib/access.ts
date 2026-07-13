// @deprecated — use `@/lib/rbac` instead. Kept as thin re-exports so existing
// call sites keep working during the RBAC v2 rollout.
import { hasPlatformRole, hasOrgRole as rbacHasOrgRole, type AppRole, type OrgRole } from "./rbac";

type AnySupabase = any;

export async function isPlatformAdmin(supabase: AnySupabase, userId: string): Promise<boolean> {
  return hasPlatformRole({ supabase, userId }, ["admin", "super_admin"] as AppRole[]);
}

export async function hasOrgRole(
  supabase: AnySupabase,
  userId: string,
  orgId: string,
  roles: readonly string[],
): Promise<boolean> {
  return rbacHasOrgRole({ supabase, userId }, orgId, roles as unknown as OrgRole[]);
}
