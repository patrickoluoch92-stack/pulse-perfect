import { describe, it, expect } from "vitest";
import { KENYA_COUNTIES, PROPERTY_CATEGORIES, slugify } from "@/lib/marketplace-constants";

describe("marketplace-constants", () => {
  it("covers all 47 Kenyan counties", () => {
    expect(KENYA_COUNTIES.length).toBe(47);
    const slugs = new Set(KENYA_COUNTIES.map((c) => c.slug));
    expect(slugs.size).toBe(47);
  });

  it("exposes the required property categories", () => {
    const names = PROPERTY_CATEGORIES.map((c) => c.value);
    for (const expected of [
      "hotel",
      "resort",
      "lodge",
      "camp",
      "guest_house",
      "serviced_apartment",
      "airbnb",
      "villa",
    ]) {
      expect(names).toContain(expected);
    }
  });

  it("slugify normalises mixed input", () => {
    expect(slugify("  Diani Beach Resort!! ")).toBe("diani-beach-resort");
    expect(slugify("Nairobi / Westlands")).toBe("nairobi-westlands");
    expect(slugify("")).toBe("");
  });
});
