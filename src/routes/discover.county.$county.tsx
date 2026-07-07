import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Sparkles } from "lucide-react";
import { listDiscoveredPublic } from "@/lib/discovery.functions";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/discover/county/$county")({
  loader: async ({ params }) => {
    if (!params.county || params.county.length < 2) throw notFound();
    return { county: params.county };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `Accommodations in County ${loaderData?.county} — HostPulse Discover` },
      {
        name: "description",
        content: `Discover verified hotels, lodges, camps and homes in county ${loaderData?.county} across Kenya.`,
      },
      { property: "og:title", content: `County ${loaderData?.county} — HostPulse Discover` },
      { property: "og:description", content: `Verified places to stay in county ${loaderData?.county}.` },
      { property: "og:type", content: "website" },
    ],
  }),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl p-10 text-center">
      <h1 className="text-2xl font-semibold">County not found</h1>
      <Link to="/discover" className="mt-3 inline-block text-primary underline">Back to discover</Link>
    </div>
  ),
  component: CountyFacet,
});

function CountyFacet() {
  const { county } = Route.useLoaderData();
  const listFn = useServerFn(listDiscoveredPublic);
  const q = useQuery({
    queryKey: ["discover-county", county],
    queryFn: () => listFn({ data: { county, limit: 60 } }),
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Link to="/discover" className="text-sm text-muted-foreground hover:underline">← All discoveries</Link>
        <h1 className="mt-3 flex items-center gap-2 text-3xl font-semibold tracking-tight">
          <MapPin className="h-6 w-6" /> County {county}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verified and AI-discovered accommodations in this county.
        </p>

        {q.isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading…</p>}
        {q.data?.rows?.length === 0 && (
          <p className="mt-8 text-sm text-muted-foreground">No properties found yet — we're still crawling.</p>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {q.data?.rows?.map((r: any) => (
            <Link
              key={r.id}
              to="/discover/$slug"
              params={{ slug: r.slug }}
              className="rounded-xl border bg-card p-5 transition hover:border-primary/50 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="line-clamp-1 font-semibold">{r.name}</h3>
                <Badge variant="outline">{r.quality_score}</Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {r.property_type && <Badge variant="secondary">{r.property_type}</Badge>}
                {r.town && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{r.town}</span>}
              </div>
              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                <Sparkles className="mr-1 inline h-3.5 w-3.5" />
                {r.ai_description ?? "AI overview pending."}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
