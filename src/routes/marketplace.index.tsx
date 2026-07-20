import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, MapPin, Star, SlidersHorizontal } from "lucide-react";

import { listPublicProperties, listCounties } from "@/lib/marketplace.functions";
import { PlanWithAI } from "@/components/plan-with-ai";
import { formatCurrency } from "@/lib/format";
import { PROPERTY_CATEGORIES, COMMON_AMENITIES, ACTIVITIES, ATTRIBUTES, categoryLabel } from "@/lib/marketplace-constants";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { PartnerListingsSection } from "@/components/PartnerListingsSection";


export const Route = createFileRoute("/marketplace/")({
  head: () => ({
    meta: [
      { title: "Kenya Hospitality Marketplace — Hotels & Lodges" },
      {
        name: "description",
        content:
          "Discover hotels, resorts, lodges, camps, guest houses, serviced apartments, Airbnb stays and villas across all 47 counties of Kenya.",
      },
      { property: "og:title", content: "Kenya Hospitality Marketplace" },
      {
        property: "og:description",
        content: "Stays across Kenya — from Maasai Mara camps to Mombasa beach resorts.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://hostpulse-perfection.lovable.app/marketplace" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://hostpulse-perfection.lovable.app/marketplace" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Kenya Hospitality Marketplace",
        description:
          "Directory of verified hotels, resorts, lodges, camps, guest houses, serviced apartments and villas across all 47 counties of Kenya.",
        url: "https://hostpulse-perfection.lovable.app/marketplace",
        isPartOf: {
          "@type": "WebSite",
          name: "HostPulse",
          url: "https://hostpulse-perfection.lovable.app",
        },
      }),
    }],
  }),
  component: MarketplaceListing,
});

function MarketplaceListing() {
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [county, setCounty] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [priceMin, setPriceMin] = useState<string>("");
  const [priceMax, setPriceMax] = useState<string>("");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [activities, setActivities] = useState<string[]>([]);
  const [attributes, setAttributes] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const listFn = useServerFn(listPublicProperties);
  const countiesFn = useServerFn(listCounties);

  const counties = useQuery({ queryKey: ["mkt-counties"], queryFn: () => countiesFn() });

  const properties = useQuery({
    queryKey: ["mkt-list", { search, county, category, priceMin, priceMax, amenities, activities, attributes, page }],
    queryFn: () =>
      listFn({
        data: {
          search: search || undefined,
          county: county === "all" ? undefined : county,
          category: (category === "all" ? undefined : category) as any,
          priceMin: priceMin === "" ? null : Number(priceMin),
          priceMax: priceMax === "" ? null : Number(priceMax),
          amenities: amenities.length > 0 ? amenities : undefined,
          activities: activities.length > 0 ? activities : undefined,
          attributes: attributes.length > 0 ? attributes : undefined,
          page,
          pageSize: 12,
        },
      }),
  });



  const featured = useQuery({
    queryKey: ["mkt-featured"],
    queryFn: () => listFn({ data: { featuredOnly: true, pageSize: 6, page: 1 } }),
  });

  const totalPages = Math.max(1, Math.ceil((properties.data?.total ?? 0) / 12));

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
              ← HostPulse
            </Link>
            <div className="flex items-center gap-4">
              <Link to="/rentals" className="text-sm text-primary hover:underline">
                Browse rental houses →
              </Link>
              <Link to="/marketplace/map" className="flex items-center gap-1 text-sm text-primary hover:underline">
                <MapPin className="h-4 w-4" /> Map view
              </Link>
            </div>
          </div>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Stay anywhere in Kenya
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
            From the Maasai Mara to the Mombasa coast — discover verified hotels, lodges,
            camps, villas and more across all 47 counties.
          </p>

          <form
            className="mt-6 flex flex-col gap-3 md:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(draftSearch);
              setPage(1);
            }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, town or keyword…"
                aria-label="Search stays by name, town or keyword"
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                className="pl-9"
                maxLength={120}
              />
            </div>
            <Select
              value={county}
              onValueChange={(v) => {
                setCounty(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="md:w-52" aria-label="Filter by county"><SelectValue placeholder="County" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All counties</SelectItem>
                {counties.data?.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={category}
              onValueChange={(v) => {
                setCategory(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="md:w-52" aria-label="Filter by property category"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {PROPERTY_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline">
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  Filters{amenities.length + (priceMin ? 1 : 0) + (priceMax ? 1 : 0) > 0 ? ` (${amenities.length + (priceMin ? 1 : 0) + (priceMax ? 1 : 0)})` : ""}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 space-y-4" align="end">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide">Price per night (KES)</Label>
                  <div className="flex gap-2">
                    <Input type="number" min={0} placeholder="Min" value={priceMin} onChange={(e) => { setPriceMin(e.target.value); setPage(1); }} />
                    <Input type="number" min={0} placeholder="Max" value={priceMax} onChange={(e) => { setPriceMax(e.target.value); setPage(1); }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide">Amenities</Label>
                  <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto">
                    {COMMON_AMENITIES.map((a) => (
                      <label key={a} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={amenities.includes(a)}
                          onCheckedChange={(checked) => {
                            setAmenities((cur) => checked ? [...cur, a] : cur.filter((x) => x !== a));
                            setPage(1);
                          }}
                        />
                        {a}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide">Property attributes</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {ATTRIBUTES.map((a) => (
                      <label key={a.value} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={attributes.includes(a.value)}
                          onCheckedChange={(checked) => {
                            setAttributes((cur) => checked ? [...cur, a.value] : cur.filter((x) => x !== a.value));
                            setPage(1);
                          }}
                        />
                        {a.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide">Activities</Label>
                  <div className="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto">
                    {ACTIVITIES.map((a) => (
                      <label key={a} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={activities.includes(a)}
                          onCheckedChange={(checked) => {
                            setActivities((cur) => checked ? [...cur, a] : cur.filter((x) => x !== a));
                            setPage(1);
                          }}
                        />
                        {a}
                      </label>
                    ))}
                  </div>
                </div>
                {(amenities.length > 0 || activities.length > 0 || attributes.length > 0 || priceMin || priceMax) && (
                  <Button
                    type="button" variant="ghost" size="sm"
                    onClick={() => { setAmenities([]); setActivities([]); setAttributes([]); setPriceMin(""); setPriceMax(""); setPage(1); }}
                  >
                    Clear filters
                  </Button>
                )}

              </PopoverContent>
            </Popover>
            <Button type="submit">Search</Button>
          </form>

        </div>
      </header>

      {featured.data && featured.data.items.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-semibold">
            <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" /> Featured stays
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.data.items.map((p) => (
              <PropertyCard key={p.id} property={p} countyName={countyName(counties.data, p.county_code)} />
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold">
              {properties.data?.total ?? 0} {properties.data?.total === 1 ? "stay" : "stays"} found
            </h2>
            <p className="text-sm text-muted-foreground">
              Browse by county or filter to find your perfect getaway
            </p>
          </div>
        </div>

        {properties.isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-72 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        )}

        {properties.data && properties.data.items.length === 0 && (
          <div className="rounded-xl border bg-card p-12 text-center">
            <p className="text-muted-foreground">No stays match your filters. Try widening the search.</p>
          </div>
        )}

        {properties.data && properties.data.items.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {properties.data.items.map((p) => (
              <PropertyCard key={p.id} property={p} countyName={countyName(counties.data, p.county_code)} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        )}
      </section>

      <PartnerListingsSection countyCode={county === "all" ? undefined : county} />

      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="mb-4 text-2xl font-semibold">Browse by county</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {counties.data?.map((c) => (
              <Link
                key={c.code}
                to="/marketplace/$county"
                params={{ county: c.slug }}
                className="rounded-lg border bg-card px-3 py-2 text-sm hover:border-primary hover:text-primary"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function countyName(counties: Array<{ code: string; name: string }> | undefined, code: string) {
  return counties?.find((c) => c.code === code)?.name ?? "";
}

export function PropertyCard({
  property,
  countyName,
}: {
  property: {
    slug: string;
    name: string;
    category: string;
    town: string;
    description: string;
    price_per_night: number | null;
    currency: string;
    main_image_url: string | null;
    is_featured?: boolean;
  };
  countyName?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-lg">
      <Link
        to="/marketplace/p/$slug"
        params={{ slug: property.slug }}
        className="block"
        aria-label={`View ${property.name}`}
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {property.main_image_url ? (
            <img
              src={property.main_image_url}
              alt={property.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-muted-foreground">
              <MapPin className="h-8 w-8" />
            </div>
          )}
          {property.is_featured && (
            <Badge className="absolute left-3 top-3 bg-yellow-500 hover:bg-yellow-500">
              Featured
            </Badge>
          )}
        </div>
        <div className="p-4 pb-14">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold leading-tight">{property.name}</h3>
          </div>
          <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
            {categoryLabel(property.category)} · {property.town}
            {countyName ? `, ${countyName}` : ""}
          </p>
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {property.description}
          </p>
          {property.price_per_night != null && (
            <p className="mt-3 text-sm">
              <span className="font-semibold">
                {formatCurrency(Number(property.price_per_night), property.currency)}
              </span>{" "}
              <span className="text-muted-foreground">/ night</span>
            </p>
          )}
        </div>
      </Link>
      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-end">
        <div className="pointer-events-auto">
          <PlanWithAI
            seed={{
              module: "travel",
              seed_intent: `Plan a trip to ${property.name} in ${property.town}${countyName ? `, ${countyName}` : ""}`,
              property_slug: property.slug,
            }}
            variant="secondary"
          />
        </div>
      </div>
    </div>
  );
}
