import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";

import { getCountyPage } from "@/lib/marketplace.functions";
import { PropertyCard } from "./marketplace.index";

const countyQuery = (slug: string) =>
  queryOptions({
    queryKey: ["mkt-county", slug],
    queryFn: () => getCountyPage({ data: { countySlug: slug } }),
  });

export const Route = createFileRoute("/marketplace/$county")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(countyQuery(params.county));
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    const name = loaderData?.county?.name ?? "County";
    return {
      meta: [
        { title: `Stays in ${name}, Kenya — Marketplace` },
        {
          name: "description",
          content: `Browse hotels, lodges, camps, villas and apartments in ${name}, Kenya. ${loaderData?.total ?? 0} verified listings.`,
        },
        { property: "og:title", content: `Stays in ${name}, Kenya` },
        {
          property: "og:description",
          content: `Discover ${loaderData?.total ?? 0} hospitality stays across ${name} county.`,
        },
        { property: "og:type", content: "website" },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl p-12 text-center">
      <h1 className="text-2xl font-semibold">County not found</h1>
      <Link to="/marketplace" className="mt-4 inline-block text-primary">
        Back to marketplace
      </Link>
    </div>
  ),
  errorComponent: ({ error, reset }) => (
    <div className="mx-auto max-w-2xl p-12 text-center">
      <h1 className="text-2xl font-semibold">Could not load county</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <button onClick={reset} className="mt-4 text-primary underline">Retry</button>
    </div>
  ),
  component: CountyPage,
});

function CountyPage() {
  const params = Route.useParams();
  const { data } = useSuspenseQuery(countyQuery(params.county));
  if (!data) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <Link to="/marketplace" className="text-sm text-muted-foreground hover:text-foreground">
            ← All counties
          </Link>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">
            Stays in {data.county.name}
          </h1>
          {data.county.region && (
            <p className="mt-1 text-muted-foreground">{data.county.region} region</p>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            {data.total} {data.total === 1 ? "listing" : "listings"} available
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-10">
        {data.items.length === 0 ? (
          <div className="rounded-xl border bg-card p-12 text-center">
            <p className="text-muted-foreground">No listings yet in {data.county.name}. Check back soon.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((p) => (
              <PropertyCard key={p.id} property={p} countyName={data.county.name} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
