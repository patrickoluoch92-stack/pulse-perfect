import { describe, it, expect } from "vitest";
import { PROPERTY_CATEGORIES, slugify, categoryLabel } from "@/lib/marketplace-constants";

describe("marketplace-constants", () => {
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

  it("categoryLabel returns a friendly label or the raw value", () => {
    expect(categoryLabel("hotel")).toBe("Hotel");
    expect(categoryLabel("unknown_thing")).toBe("unknown_thing");
  });
});
