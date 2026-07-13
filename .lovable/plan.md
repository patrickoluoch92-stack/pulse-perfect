## HostPulse RBAC Overhaul — Plan

### Current state (audit findings)
- **Platform role**: `user_roles` table with `app_role` enum (`admin`, `moderator`, `user`) + `has_role()` SECURITY DEFINER. Used for platform-admin gate (`isPlatformAdmin` in `workspace.functions.ts`, `access.ts::isPlatformAdmin`).
- **Org role**: `organization_members.role` (owner / admin / manager / staff / guest — used ad-hoc). `has_org_role()` SECURITY DEFINER used across RLS. Roles used inconsistently (`marketplace_bookings` allows `admin/owner/manager`; other tables mix `staff`).
- **Customer role**: implicit — any authenticated user without an org membership.
- **Gaps**:
  1. No "super admin" vs "moderator" distinction — single `admin` enum value.
  2. No **Enterprise** tier — orgs are flat; no parent-org / multi-branch.
  3. No **granular staff permissions** — role name is the only signal; a Receptionist and a Finance clerk both fall under `staff`.
  4. `dashboard-shell.tsx` nav is gated only by `isPlatformAdmin`; no per-feature permission checks.
  5. Audit logging exists (`audit_logs`) but is not written for privileged actions consistently.
  6. Duplicate role logic: `has_role` RPC + inline `access.ts` + scattered `.rpc("has_role")` calls in `fraud-ml.functions.ts` etc.
  7. Session security: MFA helper exists (`requireMfa`) but is only used in a few places.

### Target model

**Platform tier** (`app_role` enum extension)
- `super_admin` — full platform control (billing, integrations, secrets rotation, DevOps, all orgs)
- `admin` — existing behavior (kept for back-compat; behaves as super_admin during transition)
- `moderator` — content moderation, fraud queue, CMS; no finance/DevOps
- `support` — read-only + guest-support actions (refunds ≤ threshold, view bookings)

**Organization tier** (`organization_members.role` — keep values, add semantics)
- `owner` — org billing, delete org, invite admins
- `enterprise_admin` *(new)* — manages multiple properties/branches within org, team, reports
- `admin` — property/business admin (existing behavior)
- `manager` — property manager (operational)
- `staff` — baseline; needs granular permissions to do anything sensitive
- `guest` — customer/booker (read-own)

**Granular staff permissions** (new `organization_member_permissions` table)
- Permission strings: `bookings.read`, `bookings.write`, `bookings.refund`, `pricing.write`, `availability.write`, `reviews.moderate`, `finance.read`, `finance.payout`, `marketing.write`, `guests.pii.read`, `team.invite`, `reports.read`
- Server-side check: `has_permission(user, org, permission)` — SECURITY DEFINER, evaluates role defaults + explicit grants.

### Deliverables

1. **Migration** `rbac_v2`:
   - Extend `app_role` enum: `super_admin`, `moderator`, `support`.
   - Create `permission` enum + `organization_member_permissions(org_id, user_id, permission, granted_by, granted_at)`.
   - Add `role_permission_defaults(role, permission)` seed table for role → default permissions mapping.
   - `has_permission(_user, _org, _permission)` SECURITY DEFINER function that evaluates defaults ∪ explicit grants ∪ platform-role overrides.
   - `has_platform_role(_user, _role)` wrapper that treats `super_admin` as satisfying `admin` checks (back-compat).
   - GRANTS + tighten RLS on the new tables (least privilege — only self-read + admin-manage).
   - Backfill: existing `admin` → also mark `super_admin`; existing org `owner`/`admin` get all permission defaults.
   - Extend `audit_logs` triggers on: role changes, permission grants, payout approvals, member removals, security setting changes.

2. **Server-side helpers** (`src/lib/rbac.ts` — replaces `access.ts` and inline `.rpc("has_role")` calls):
   - `requirePlatformRole(ctx, roles[])`, `requireOrgRole(ctx, orgId, roles[])`, `requirePermission(ctx, orgId, permission)`.
   - All throw structured `ForbiddenError` and write to `audit_logs` on denial (rate-limited).
   - Uses the authenticated `context.supabase` (RLS-respecting) — no service role for authz checks.

3. **Refactor sweep** — replace ad-hoc admin checks:
   - `fraud-ml.functions.ts::assertAdmin` → `requirePlatformRole(ctx, ["admin","super_admin","moderator"])`.
   - `executive.functions.ts`, `admin-ops.functions.ts`, `finance.functions.ts` payout approval, `subscription.server.ts` → use `requirePlatformRole` / `requirePermission`.
   - `command-center.functions.ts` guest PII columns → gate behind `guests.pii.read`.
   - Booking refund/cancel flows in `marketplace.functions.ts` → `requirePermission("bookings.refund")`.
   - Remove duplicate helpers; keep a single source in `rbac.ts`.

4. **Client**:
   - `src/hooks/use-permissions.ts` — reads `workspace-context` + a new `getMyPermissions` server fn.
   - `dashboard-shell.tsx` — nav gated per permission (Finance items → `finance.read`; Team → `team.invite`; Admin group → platform role tiers, split "Executive HQ / Finance Admin" (super_admin) from "Fraud / CMS" (moderator)).
   - `<Can permission="…">` component for inline UI gating.
   - Server-side is authoritative — client hiding is UX only.

5. **Team/settings UI** (`_authenticated/team.tsx`):
   - Role picker updated with new roles + tooltip descriptions.
   - Per-member permission matrix (checkbox grid) for `staff`; other roles show read-only default matrix.
   - Invite dialog gets role + optional initial permissions.

6. **MFA elevation** — enforce `requireMfa()` for: role changes, permission grants, payout approval, secret rotation, org deletion, member removal at admin+ tier.

7. **Audit log surface** — extend `admin.executive.tsx` (Activity feed already there) to filter by category: `authz`, `role_change`, `payout`, `security`; export CSV.

8. **Docs** — `docs/RBAC.md` documenting tiers, permissions, and the check matrix; update `docs/EXCELLENCE_AUDIT.md` cross-refs.

### Technical details

- **Least privilege on new tables**: `organization_member_permissions` — `SELECT` policy: self (`user_id = auth.uid()`) OR org admin (`has_org_role`); `INSERT/UPDATE/DELETE`: org admin + `has_permission(caller, org, 'team.invite')` + MFA.
- **Back-compat**: `has_role(_user, 'admin')` continues to return true for both `admin` and `super_admin` so existing RLS policies keep working. Old `access.ts` re-exports from `rbac.ts` with a `@deprecated` JSDoc for gradual code migration.
- **No breaking DB drops**: no columns removed, no roles removed; enum values only added.
- **Testing**: extend `tests/security.test.ts` with permission-matrix unit tests and add `tests/rbac.test.ts` covering role→permission resolution + escalation attempts.

### Out of scope (call out to user)
- Multi-tenant "enterprise parent org / child branches" tree (would require reshaping `organizations`; propose separately if wanted).
- Custom user-defined roles beyond the enum + per-member permission overrides (the permission grid already covers this without needing a role-definition UI).
- SSO group→role mapping (Supabase SAML SSO wiring; add if requested).

### Rollout order (single build session)
1. Migration + RLS + backfill.
2. `rbac.ts` + refactor server functions.
3. Client hook + shell nav gating + `<Can>` component.
4. Team UI permission matrix.
5. MFA hardening + audit sweep.
6. Docs + tests.

Confirm and I'll ship it — or tell me to drop/adjust any of the tiers, permissions, or out-of-scope items.