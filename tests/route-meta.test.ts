import { describe, it, expect } from "vitest";
import { authPageMeta } from "@/lib/route-meta";

describe("authPageMeta", () => {
  const meta = authPageMeta({ title: "Dashboard", description: "Your overview." });

  it("suffixes the title with the brand", () => {
    const title = meta.find((m) => "title" in m) as { title: string };
    expect(title.title).toBe("Dashboard — HostPulse");
  });

  it("emits noindex robots for authenticated pages", () => {
    const robots = meta.find((m) => (m as { name?: string }).name === "robots") as { content: string };
    expect(robots.content).toBe("noindex, nofollow");
  });

  it("populates OG and Twitter card variants", () => {
    const ogTitle = meta.find((m) => (m as { property?: string }).property === "og:title") as { content: string };
    const twTitle = meta.find((m) => (m as { name?: string }).name === "twitter:title") as { content: string };
    expect(ogTitle.content).toBe("Dashboard — HostPulse");
    expect(twTitle.content).toBe("Dashboard — HostPulse");
    expect(meta.some((m) => (m as { property?: string }).property === "og:site_name")).toBe(true);
    expect(meta.some((m) => (m as { name?: string }).name === "twitter:card")).toBe(true);
  });

  it("propagates description into description, og:description, twitter:description", () => {
    const description = "Your overview.";
    expect(meta.filter((m) => {
      const v = m as { content?: string };
      return v.content === description;
    })).toHaveLength(3);
  });
});
