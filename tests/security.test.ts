import { describe, it, expect } from "vitest";
import { hasMfa, requireMfa } from "@/lib/security";

describe("hasMfa", () => {
  it("returns true when claims.aal is aal2", () => {
    expect(hasMfa({ aal: "aal2" })).toBe(true);
  });
  it("returns false when claims missing or aal1", () => {
    expect(hasMfa(null)).toBe(false);
    expect(hasMfa(undefined)).toBe(false);
    expect(hasMfa({})).toBe(false);
    expect(hasMfa({ aal: "aal1" })).toBe(false);
  });
});

describe("requireMfa", () => {
  it("throws when not aal2", () => {
    expect(() => requireMfa({ aal: "aal1" })).toThrow(/MFA required/);
    expect(() => requireMfa(null)).toThrow(/MFA required/);
  });
  it("passes when aal2", () => {
    expect(() => requireMfa({ aal: "aal2" })).not.toThrow();
  });
});
