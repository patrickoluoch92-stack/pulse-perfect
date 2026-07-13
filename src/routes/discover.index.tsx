import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, MapPin, Sparkles } from "lucide-react";
import { listDiscoveredPublic, countyCoveragePublic } from "@/lib/discovery.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanWithAI } from "@/components/plan-with-ai";
import { EmptyState, LoadingState } from "@/components/ui/states";

export const Route = createFileRoute("/discover/")({
  head: () => ({
    meta: [
      { title: "Discover Kenyan Accommodation — AI Property Directory" },
      {
        name: "description",
        content:
          "Continuously updated directory of Kenyan hotels, lodges, camps, guest houses, villas and apartments across all 47 counties. Own a business? Claim your listing.",
      },
      { property: "og:title", content: "Discover Kenyan Accommodation" },
      {
        property: "og:description",
        content: "AI-curated directory of accommodations across all 47 counties of Kenya.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DiscoverIndex,
});

function DiscoverIndex() {
  const [q, setQ] = useState("");
  const list = useServerFn(listDiscoveredPublic);
  const coverage = useServerFn(countyCoveragePublic);
  const listing = useQuery({
    queryKey: ["discover-public", q],
    queryFn: () => list({ data: { q: q || undefined, limit: 48 } }),
  });
  const cov = useQuery({ queryKey: ["discover-coverage"], queryFn: () => coverage() });

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-gradient-to-b from-muted/40 to-transparent">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> AI Property Intelligence
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Discover accommodation across Kenya
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Hotels, lodges, guest houses, camps, apartments and holiday homes — continuously discovered from public tourism sources and enriched with AI. Own a business here? Claim it in minutes.
          </p>
          <form
            className="mt-6 flex max-w-xl gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              listing.refetch();
            }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name, town, or county…"
                className="pl-9"
              />
            </div>
            <Button type="submit">Search</Button>
          </form>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Latest discoveries</h2>
          <span className="text-sm text-muted-foreground">
            {listing.data?.rows?.length ?? 0} properties
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(listing.data?.rows ?? []).map((r: any) => (
            <div key={r.id} className="group relative">
              <Link
                to="/discover/$slug"
                params={{ slug: r.slug }}
                aria-label={`View ${r.name}`}
              >
                <Card className="h-full pb-14 transition hover:shadow-md">
                  <CardHeader>
                    <CardTitle className="line-clamp-2 text-base">{r.name}</CardTitle>
                    <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                      <Badge variant="secondary">{r.property_type ?? "unknown"}</Badge>
                      {r.county_code && <Badge variant="outline">County {r.county_code}</Badge>}
                      {r.town && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {r.town}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="line-clamp-3 text-sm text-muted-foreground">
                      {r.ai_description ?? "No description yet."}
                    </p>
                    <div className="mt-3 text-xs text-muted-foreground">
                      Quality {r.quality_score}/100
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <div className="absolute inset-x-3 bottom-3 flex justify-end">
                <PlanWithAI
                  seed={{
                    module: "travel",
                    seed_intent: `Plan a trip to ${r.name}${r.town ? ` in ${r.town}` : ""}`,
                  }}
                  variant="secondary"
                />
              </div>
            </div>
          ))}
          {listing.isLoading && (
            <div className="col-span-full"><LoadingState label="Loading discoveries…" /></div>
          )}
          {!listing.isLoading && (listing.data?.rows?.length ?? 0) === 0 && (
            <div className="col-span-full">
              <EmptyState
                title="No discoveries yet"
                description="The discovery engine runs in the background — check back soon."
              />
            </div>
          )}
        </div>

        {cov.data?.counts && Object.keys(cov.data.counts).length > 0 && (
          <div className="mt-12">
            <h3 className="mb-3 text-lg font-semibold">County coverage</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(cov.data.counts)
                .sort((a, b) => (b[1] as number) - (a[1] as number))
                .map(([c, n]) => (
                  <Badge key={c} variant="outline">
                    County {c} · {n as number}
                  </Badge>
                ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
