import { describe, it, expect } from "vitest";
import { escapeCsvField, buildCsv, makeRateLimiter } from "@/lib/csv";

describe("escapeCsvField — formula injection hardening", () => {
  it("prefixes leading = with single quote", () => {
    expect(escapeCsvField("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
  });
  it("prefixes leading + - @ as well", () => {
    expect(escapeCsvField("+1")).toBe("'+1");
    expect(escapeCsvField("-2")).toBe("'-2");
    expect(escapeCsvField("@cmd")).toBe("'@cmd");
  });
  it("prefixes leading tab and CR (clipboard tricks)", () => {
    expect(escapeCsvField("\t=evil")).toBe("'\t=evil");
    // \r forces quoting, but the leading ' is still applied first
    expect(escapeCsvField("\revil")).toBe('"\'\revil"');
  });
  it("does not prefix safe leading text", () => {
    expect(escapeCsvField("hello")).toBe("hello");
    expect(escapeCsvField("123")).toBe("123");
  });
});

describe("escapeCsvField — quoting", () => {
  it("quotes fields containing a comma", () => {
    expect(escapeCsvField("a,b")).toBe('"a,b"');
  });
  it("quotes and doubles embedded quotes", () => {
    expect(escapeCsvField('he said "hi"')).toBe('"he said ""hi"""');
  });
  it("quotes fields with newlines", () => {
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
  });
  it("handles null/undefined as empty string", () => {
    expect(escapeCsvField(null)).toBe("");
    expect(escapeCsvField(undefined)).toBe("");
  });
});

describe("escapeCsvField — overflow", () => {
  it("truncates excessively long values", () => {
    const huge = "a".repeat(100_000);
    expect(escapeCsvField(huge).length).toBeLessThanOrEqual(32_768);
  });
});

describe("buildCsv", () => {
  it("prepends BOM and joins header + rows", () => {
    const out = buildCsv(
      ["name", "score"],
      [
        ["a", 1],
        ["b,c", 2],
      ],
    );
    expect(out.charCodeAt(0)).toBe(0xfeff);
    expect(out).toContain("name,score");
    expect(out).toContain('"b,c",2');
  });
  it("escapes a formula in any cell", () => {
    const out = buildCsv(["x"], [["=evil()"]]);
    expect(out).toContain("'=evil()");
  });
});

describe("makeRateLimiter", () => {
  it("allows up to max calls then throws", () => {
    const limit = makeRateLimiter(3, 60_000);
    const now = 1_000;
    limit("u1", now);
    limit("u1", now);
    limit("u1", now);
    expect(() => limit("u1", now)).toThrow(/Too many requests/);
  });
  it("forgets entries outside the window", () => {
    const limit = makeRateLimiter(2, 1_000);
    limit("u1", 0);
    limit("u1", 500);
    expect(() => limit("u1", 800)).toThrow();
    // 1100ms later — first hit aged out, room for one more
    expect(() => limit("u1", 1_600)).not.toThrow();
  });
  it("scopes counts per key", () => {
    const limit = makeRateLimiter(1, 60_000);
    limit("a", 0);
    expect(() => limit("b", 0)).not.toThrow();
    expect(() => limit("a", 0)).toThrow();
  });
});
