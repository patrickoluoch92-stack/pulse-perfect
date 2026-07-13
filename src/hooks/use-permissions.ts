import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyPermissions } from "@/lib/rbac.functions";
import { getWorkspaceContext } from "@/lib/workspace.functions";

export type Permission =
  | "bookings.read" | "bookings.write" | "bookings.refund"
  | "pricing.write" | "availability.write" | "reviews.moderate"
  | "finance.read" | "finance.payout" | "marketing.write"
  | "guests.pii.read" | "team.invite" | "reports.read";

/**
 * Client-side permission hook. UI-only; the server re-checks everything.
 * Returns { can(permission), isLoading, platformAdmin }.
 */
export function usePermissions() {
  const fetchCtx = useServerFn(getWorkspaceContext);
  const fetchPerms = useServerFn(getMyPermissions);

  const ctx = useQuery({ queryKey: ["workspace-context"], queryFn: () => fetchCtx() });
  const orgId = ctx.data?.currentOrg?.id;

  const perms = useQuery({
    queryKey: ["my-permissions", orgId],
    queryFn: () => fetchPerms({ data: { orgId: orgId! } }),
    enabled: !!orgId,
    staleTime: 60_000,
  });

  const set = new Set<string>(perms.data?.permissions ?? []);
  const platformAdmin = perms.data?.platformAdmin ?? ctx.data?.isPlatformAdmin ?? false;

  return {
    isLoading: ctx.isLoading || perms.isLoading,
    platformAdmin,
    orgRole: ctx.data?.currentOrg?.role ?? null,
    can(permission: Permission) {
      return platformAdmin || set.has(permission);
    },
  };
}
