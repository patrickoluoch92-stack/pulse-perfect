import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const BASE_URL = "https://hostpulse-perfection.lovable.app";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "daily" | "weekly" | "monthly" | "yearly";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/pricing", changefreq: "monthly", priority: "0.8" },
          { path: "/marketplace", changefreq: "daily", priority: "0.9" },
        ];

        // Pull counties + approved listings via the public anon client.
        try {
          const supa = createClient<Database>(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
          );

          const [{ data: counties }, { data: props }] = await Promise.all([
            supa.from("kenya_counties").select("slug").order("name"),
            supa
              .from("marketplace_properties")
              .select("slug, updated_at")
              .eq("status", "approved")
              .order("updated_at", { ascending: false })
              .limit(5000),
          ]);

          for (const c of counties ?? []) {
            entries.push({
              path: `/marketplace/${c.slug}`,
              changefreq: "weekly",
              priority: "0.7",
            });
            entries.push({
              path: `/counties/${c.slug}`,
              changefreq: "weekly",
              priority: "0.6",
            });
          }
          for (const p of props ?? []) {
            entries.push({
              path: `/marketplace/p/${p.slug}`,
              lastmod: p.updated_at ?? undefined,
              changefreq: "weekly",
              priority: "0.6",
            });
          }
        } catch {
          // If the DB read fails at build/SSR time, still ship the static entries.
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
