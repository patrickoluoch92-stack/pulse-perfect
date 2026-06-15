// Helper to build per-route meta for authenticated (private) pages.
// These pages are behind auth, so we noindex them and skip canonical/og:url.
export function authPageMeta(opts: { title: string; description: string }) {
  const fullTitle = `${opts.title} — HostPulse`;
  return [
    { title: fullTitle },
    { name: "description", content: opts.description },
    { name: "robots", content: "noindex, nofollow" },
    { property: "og:title", content: fullTitle },
    { property: "og:description", content: opts.description },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "HostPulse" },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: fullTitle },
    { name: "twitter:description", content: opts.description },
  ];
}
