// Inline replacements for SECURITY DEFINER RPC helpers (has_role / has_org_role).
// The Supabase linter flags those RPCs as callable by signed-in users, so we no
// longer invoke them directly — they remain available inside RLS policy
// evaluation. RLS on user_roles / organization_members lets signed-in users
// read their own rows, so these checks work with the authenticated client.

type AnySupabase = any;

export async function isPlatformAdmin(supabase: AnySupabase, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}

export async function hasOrgRole(
  supabase: AnySupabase,
  userId: string,
  orgId: string,
  roles: readonly string[],
): Promise<boolean> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .in("role", roles as string[])
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}
