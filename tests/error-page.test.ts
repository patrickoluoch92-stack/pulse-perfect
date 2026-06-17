import { describe, it, expect } from "vitest";
import { renderErrorPage } from "@/lib/error-page";

describe("renderErrorPage", () => {
  const html = renderErrorPage();

  it("returns a complete HTML document", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toMatch(/<\/html>\s*$/);
  });

  it("includes recovery actions", () => {
    expect(html).toMatch(/Try again/);
    expect(html).toMatch(/href="\/"/);
  });

  it("sets a viewport meta tag", () => {
    expect(html).toMatch(/name="viewport"/);
  });
});
