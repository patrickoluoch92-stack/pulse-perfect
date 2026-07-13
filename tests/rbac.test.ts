import { describe, it, expect } from "vitest";
import {
  ForbiddenError,
  PLATFORM_ROLES,
  ORG_ROLES,
  hasPlatformRole,
  hasOrgRole,
  requirePlatformRole,
  requireOrgRole,
} from "@/lib/rbac";

// Minimal supabase-like stub. Query builder is chainable and returns { data }.
function makeCtx(opts: { platformRoles?: string[]; orgRoles?: Record<string, string[]> }) {
  const supabase = {
    from(table: string) {
      const state: {
        table: string;
        eq: Record<string, unknown>;
        inKey?: string;
        inValues?: string[];
        _maybeSingle?: boolean;
      } = { table, eq: {} };
      const builder: any = {
        select: () => builder,
        eq: (k: string, v: unknown) => { state.eq[k] = v; return builder; },
        in: (k: string, v: string[]) => { state.inKey = k; state.inValues = v; return builder; },
        maybeSingle: () => {
          state._maybeSingle = true;
          return runQuery(state, opts).then((rows) => ({ data: rows[0] ?? null }));
        },
        then: (resolve: (v: unknown) => void) =>
          runQuery(state, opts).then((rows) => resolve({ data: rows })),
      };
      return builder;
    },
  };
  return { supabase, userId: "u1" };
}

async function runQuery(state: any, opts: any): Promise<any[]> {
  if (state.table === "user_roles") {
    const roles = new Set(opts.platformRoles ?? []);
    const wanted = state.inValues ?? [];
    return wanted.filter((r: string) => roles.has(r)).map((r: string) => ({ role: r }));
  }
  if (state.table === "organization_members") {
    const orgId = state.eq["org_id"];
    const roles = new Set(opts.orgRoles?.[orgId] ?? []);
    const wanted = state.inValues ?? [];
    const match = wanted.find((r: string) => roles.has(r));
    return match ? [{ role: match }] : [];
  }
  return [];
}

describe("rbac constants", () => {
  it("exposes all platform + org roles", () => {
    expect(PLATFORM_ROLES).toContain("super_admin");
    expect(PLATFORM_ROLES).toContain("support");
    expect(ORG_ROLES).toContain("enterprise_admin");
    expect(ORG_ROLES).toContain("guest");
  });
});

describe("hasPlatformRole", () => {
  it("returns true when role matches", async () => {
    const ctx = makeCtx({ platformRoles: ["moderator"] });
    expect(await hasPlatformRole(ctx, ["moderator"])).toBe(true);
  });
  it("admin satisfies super_admin (back-compat)", async () => {
    const ctx = makeCtx({ platformRoles: ["admin"] });
    expect(await hasPlatformRole(ctx, ["super_admin"])).toBe(true);
  });
  it("returns false without matching role", async () => {
    const ctx = makeCtx({ platformRoles: ["user"] });
    expect(await hasPlatformRole(ctx, ["moderator"])).toBe(false);
  });
});

describe("hasOrgRole", () => {
  it("matches when member has role", async () => {
    const ctx = makeCtx({ orgRoles: { "org-1": ["manager"] } });
    expect(await hasOrgRole(ctx, "org-1", ["manager", "admin"])).toBe(true);
  });
  it("returns false for wrong org", async () => {
    const ctx = makeCtx({ orgRoles: { "org-1": ["admin"] } });
    expect(await hasOrgRole(ctx, "org-2", ["admin"])).toBe(false);
  });
});

describe("require helpers throw ForbiddenError", () => {
  it("requirePlatformRole throws when missing", async () => {
    const ctx = makeCtx({});
    await expect(requirePlatformRole(ctx, ["admin"])).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("requireOrgRole is bypassed by platform admin", async () => {
    const ctx = makeCtx({ platformRoles: ["admin"] });
    await expect(requireOrgRole(ctx, "org-1", ["owner"])).resolves.toBeUndefined();
  });
});
