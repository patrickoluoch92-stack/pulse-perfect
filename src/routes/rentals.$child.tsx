import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Star, ArrowLeft } from "lucide-react";
import { getCategoryBySlug } from "@/lib/taxonomy.functions";
import { listPublicProperties, listCounties } from "@/lib/marketplace.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlanWithAI } from "@/components/plan-with-ai";
import { formatCurrency } from "@/lib/format";
import { EmptyState, LoadingState } from "@/components/ui/states";

export const Route = createFileRoute("/rentals/$child")({
  loader: async ({ params }) => {
    const meta = await getCategoryBySlug({ data: { slug: params.child } });
    if (!meta) throw notFound();
    return meta;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Not found" }, { name: "robots", content: "noindex" }] };
    const n = loaderData.node;
    const title = n.seo_title ?? `${n.name} for Rent in Kenya | HostPulse`;
    const desc = n.seo_description ?? `Browse ${n.name.toLowerCase()} rentals across Kenya. Filter by county, town, budget, and amenities.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
      ],
      links: [{ rel: "canonical", href: `/rentals/${n.slug}` }],
    };
  },
  component: ChildCategoryPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl p-12 text-center">
      <h1 className="text-2xl font-semibold">Category not found</h1>
      <Link to="/rentals" className="mt-4 inline-block text-primary underline">Back to rentals</Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl p-12 text-center">
      <p className="text-destructive">{error.message}</p>
    </div>
  ),
});

function ChildCategoryPage() {
  const { child } = Route.useParams();
  const { node, parent, siblings } = Route.useLoaderData();
  const [county, setCounty] = useState("all");
  const [town, setTown] = useState("");
  const [priceMax, setPriceMax] = useState("");

  const listFn = useServerFn(listPublicProperties);
  const countiesFn = useServerFn(listCounties);
  const counties = useQuery({ queryKey: ["mkt-counties"], queryFn: () => countiesFn() });

  const results = useQuery({
    queryKey: ["rentals-child", child, county, town, priceMax],
    queryFn: () => listFn({
      data: {
        childSlug: child,
        county: county === "all" ? undefined : county,
        search: town || undefined,
        priceMax: priceMax === "" ? null : Number(priceMax),
        pageSize: 24,
      },
    }),
  });

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "/" },
      { "@type": "ListItem", position: 2, name: parent?.name ?? "Rentals", item: "/rentals" },
      { "@type": "ListItem", position: 3, name: node.name, item: `/rentals/${node.slug}` },
    ],
  };

  return (
    <div className="min-h-dvh bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <section className="border-b bg-gradient-to-b from-primary/5 to-transparent">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <nav className="mb-3 text-sm text-muted-foreground">
            <Link to="/" className="hover:underline">Home</Link> /{" "}
            <Link to="/rentals" className="hover:underline">{parent?.name ?? "Rentals"}</Link> /{" "}
            <span className="text-foreground">{node.name}</span>
          </nav>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold tracking-tight">{node.name} for Rent</h1>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                {node.seo_description ?? `Browse ${node.name.toLowerCase()} listings across Kenya. Filter by county, town, and budget.`}
              </p>
            </div>
            <PlanWithAI
              label="Plan with AI"
              seed={{ seed_intent: `Help me find a ${node.name.toLowerCase()} to rent in Kenya`, module: "rental", child_category: node.slug }}
            />
          </div>

          {siblings.length > 1 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {siblings.map((s: any) => (
                <Link key={s.slug} to="/rentals/$child" params={{ child: s.slug }}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${s.slug === node.slug ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"}`}>
                  {s.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 grid gap-3 md:grid-cols-4">
          <Select value={county} onValueChange={setCounty}>
            <SelectTrigger><SelectValue placeholder="County" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All counties</SelectItem>
              {(counties.data ?? []).map((c: any) => (
                <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Town / area" value={town} onChange={e => setTown(e.target.value)} />
          <Input placeholder="Max budget (KES)" type="number" value={priceMax} onChange={e => setPriceMax(e.target.value)} />
          <Button variant="outline" onClick={() => { setCounty("all"); setTown(""); setPriceMax(""); }}>Reset</Button>
        </div>

        {results.isLoading && <LoadingState label="Loading listings…" />}
        {!results.isLoading && results.data?.items?.length === 0 && (
          <EmptyState
            title={`No ${node.name.toLowerCase()} listings match your filters yet`}
            description="Try widening your filters or exploring another category."
            action={<Link to="/rentals" className="inline-flex items-center gap-1 text-primary underline"><ArrowLeft className="h-4 w-4" /> Try another category</Link>}
          />
        )}


        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(results.data?.items ?? []).map((p: any) => (
            <Link key={p.id} to="/marketplace/p/$slug" params={{ slug: p.slug }}>
              <Card className="h-full transition-shadow hover:shadow-md">
                {p.main_image_path && (
                  <img src={p.main_image_path} alt={p.name} className="h-40 w-full rounded-t-lg object-cover" loading="lazy" />
                )}
                <CardContent className="p-4">
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {p.town} · {p.county_code}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="font-medium">{formatCurrency(Number(p.price_per_night), p.currency)}</span>
                    {p.rating_avg > 0 && (
                      <span className="flex items-center gap-1 text-xs">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {Number(p.rating_avg).toFixed(1)}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <p className="mt-6 text-xs text-muted-foreground">{results.data?.total ?? 0} results</p>
      </section>
    </div>
  );
}
