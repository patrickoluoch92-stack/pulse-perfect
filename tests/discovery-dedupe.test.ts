import { describe, it, expect } from "vitest";
import {
  normalizePhone,
  normalizeDomain,
  normalizeName,
  fingerprint,
  slugify,
  haversineKm,
} from "@/lib/discovery-dedupe.server";

describe("discovery-dedupe", () => {
  it("normalizes Kenyan phones to +254 format", () => {
    expect(normalizePhone("0712 345 678")).toBe("+254712345678");
    expect(normalizePhone("254712345678")).toBe("+254712345678");
    expect(normalizePhone(null)).toBeNull();
  });

  it("strips www from domains", () => {
    expect(normalizeDomain("https://www.Example.com/path")).toBe("example.com");
    expect(normalizeDomain("example.com")).toBe("example.com");
  });

  it("normalizes names by removing common stopwords", () => {
    expect(normalizeName("The Serena Hotel & Lodge")).toContain("serena");
    expect(normalizeName(null as any)).toBe("");
  });

  it("produces deterministic fingerprint", () => {
    const fp1 = fingerprint({ name: "Serena", county_code: "NBI", phone: "0712345678" });
    const fp2 = fingerprint({ name: "Serena", county_code: "NBI", phone: "254712345678" });
    expect(fp1).toBe(fp2);
    expect(fp1).toHaveLength(32);
  });

  it("slugifies and truncates", () => {
    expect(slugify("The Serena Hotel!")).toBe("the-serena-hotel");
    expect(slugify("Foo", "abc")).toBe("foo-abc");
  });

  it("computes haversine distance", () => {
    const km = haversineKm({ lat: -1.286, lng: 36.817 }, { lat: -1.292, lng: 36.821 });
    expect(km).toBeLessThan(2);
  });
});
