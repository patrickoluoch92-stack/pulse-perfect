import { describe, it, expect } from "vitest";
import { requireMfa, hasMfa } from "@/lib/security";

describe("MFA gate", () => {
  it("rejects sessions without aal2", () => {
    expect(() => requireMfa({ aal: "aal1" })).toThrow(/MFA required/);
    expect(() => requireMfa({})).toThrow(/MFA required/);
    expect(() => requireMfa(null)).toThrow(/MFA required/);
    expect(() => requireMfa(undefined)).toThrow(/MFA required/);
  });

  it("accepts aal2 sessions", () => {
    expect(() => requireMfa({ aal: "aal2" })).not.toThrow();
  });

  it("hasMfa mirrors the gate", () => {
    expect(hasMfa({ aal: "aal2" })).toBe(true);
    expect(hasMfa({ aal: "aal1" })).toBe(false);
    expect(hasMfa(null)).toBe(false);
  });

  it("ignores non-aal claims", () => {
    expect(() =>
      requireMfa({ sub: "user-1", role: "authenticated", amr: [{ method: "password" }] }),
    ).toThrow(/MFA required/);
    expect(() =>
      requireMfa({ sub: "user-1", role: "authenticated", aal: "aal2", amr: [{ method: "totp" }] }),
    ).not.toThrow();
  });
});
