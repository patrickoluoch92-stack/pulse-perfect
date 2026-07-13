# HostPulse RBAC (Role-Based Access Control)

HostPulse enforces a two-tier RBAC model with a fine-grained permission
layer on top. Every privileged action is checked **server-side** — the
client hides UI as a UX affordance, never as a security boundary.

## Tiers

### Platform (`app_role` enum, table `user_roles`)

| Role          | Purpose                                                                 |
|---------------|-------------------------------------------------------------------------|
| `super_admin` | Full platform control: billing, integrations, secrets, DevOps, all orgs |
| `admin`       | Legacy super-admin (kept for back-compat; behaves as `super_admin`)     |
| `moderator`   | Content moderation, fraud queue, CMS; no finance/DevOps                 |
| `support`     | Guest support: view bookings, refunds ≤ threshold                       |
| `user`        | Baseline; no platform privileges                                        |

### Organization (`org_role` enum, table `organization_members`)

| Role               | Purpose                                                             |
|--------------------|---------------------------------------------------------------------|
| `owner`            | Org billing, delete org, invite admins                              |
| `enterprise_admin` | Manage multiple properties/branches, team, reports                  |
| `admin`            | Property / business admin                                           |
| `manager`          | Operational — bookings, pricing, availability, reviews              |
| `staff`            | Baseline; needs explicit permissions to do anything sensitive       |
| `guest`            | Customer / booker (read-own)                                        |

## Permissions (fine-grained)

Twelve permissions in the `rbac_permissions` catalog cover the sensitive surface:

- `bookings.read`, `bookings.write`, `bookings.refund`
- `pricing.write`, `availability.write`
- `reviews.moderate`
- `finance.read`, `finance.payout`
- `marketing.write`
- `guests.pii.read`
- `team.invite`
- `reports.read`

Each org role has a default set via `rbac_role_defaults`. Owners/admins may
grant or revoke individual permissions per member via
`organization_member_permissions`.

## Resolution order

For a given user + org + permission the DB function `has_permission()` returns
true when **any** of the following holds:

1. The user has platform role `admin` (super-admin bypass).
2. There is an explicit **grant** in `organization_member_permissions`
   (and no explicit revoke).
3. The user's org role has the permission in `rbac_role_defaults`
   (and no explicit revoke).

Explicit `revoke` beats defaults, so managers whose finance access was
revoked can't see finance data even though the default would allow it.

## How to check permissions

### Server-side (authoritative)

```ts
import { requirePermission, requirePlatformRole } from "@/lib/rbac";

// In a createServerFn .handler({ context, data }):
await requirePlatformRole(context, ["admin", "super_admin", "moderator"]);
await requirePermission(context, orgId, "finance.payout");
```

Both throw `ForbiddenError` (HTTP 403) on failure; failures are auto-logged
by the `audit_rbac_change` triggers on the underlying tables.

### Client-side (UX only)

```tsx
import { usePermissions } from "@/hooks/use-permissions";
import { Can } from "@/components/Can";

const { can, platformAdmin } = usePermissions();

<Can permission="finance.read">
  <FinanceCard />
</Can>
```

The `<Can>` component and `usePermissions()` hook hide UI when the caller
lacks a permission. The server re-checks the same permission on every
mutation, so this is defense-in-depth, not the security boundary.

## MFA elevation

Actions with elevated risk require an AAL2 (MFA-authenticated) session.
`requireMfa(context.claims)` throws when the caller's JWT `aal` is not
`aal2`. Applied to:

- Role changes (`organization_members.role`)
- Permission grants / revokes (`organization_member_permissions`)
- Payout approvals (`finance.payout`)
- Member removal, org deletion
- Secret rotation

## Audit logging

Row-level triggers on `organization_members`, `user_roles`, and
`organization_member_permissions` insert into `audit_logs` on every
`INSERT / UPDATE / DELETE`, recording:

- `actor_id` — who made the change (from `auth.uid()`)
- `target_type`, `target_id` — the affected table + user
- `metadata` — old/new role, permission key, effect

View the resulting activity feed in Platform Admin → Executive HQ.

## Least privilege checklist

- No new SECURITY DEFINER function should be granted to `PUBLIC` — always
  `REVOKE ALL FROM PUBLIC` and `GRANT EXECUTE ... TO authenticated, service_role`
  (or narrower).
- Every new sensitive server function must call `requirePlatformRole`,
  `requireOrgRole`, or `requirePermission` before touching data.
- Client UI that gates behavior on a role/permission must use
  `usePermissions()` / `<Can>`, never hardcoded role name checks.
