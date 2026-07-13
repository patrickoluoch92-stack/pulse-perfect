import type { ReactNode } from "react";
import { usePermissions, type Permission } from "@/hooks/use-permissions";

/**
 * UI gate for a fine-grained permission. Server-side is always authoritative.
 * Renders `fallback` (default: nothing) if the caller lacks the permission.
 */
export function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can, isLoading } = usePermissions();
  if (isLoading) return null;
  return can(permission) ? <>{children}</> : <>{fallback}</>;
}
