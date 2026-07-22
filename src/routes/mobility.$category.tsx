import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { searchMobilityVehicles, MOBILITY_CATEGORY_LABELS, MOBILITY_CATEGORIES, MOBILITY_VEHICLE_TYPES, MOBILITY_VEHICLE_TYPE_LABELS, type MobilityCategory, type MobilityVehicleType } from "@/lib/mobility.functions";
import { listCounties } from "@/lib/marketplace.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState, EmptyState } from "@/components/ui/states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebouncedValue } from "@/hooks/use-debounced-value";


export const Route = createFileRoute("/mobility/$category")({
  beforeLoad: ({ params }) => {
    if (!(MOBILITY_CATEGORIES as readonly string[]).includes(params.category)) throw notFound();
  },
  head: ({ params }) => {
    const label = MOBILITY_CATEGORY_LABELS[params.category as MobilityCategory] ?? "Mobility";
    return {
      meta: [
        { title: `${label} in Kenya | HostPulse` },
        { name: "description", content: `Book ${label.toLowerCase()} across Kenya on HostPulse. Compare vehicles, pickup locations, and daily rates.` },
        { property: "og:title", content: `${label} in Kenya` },
        { property: "og:description", content: `Compare ${label.toLowerCase()} across Kenya on HostPulse.` },
      ],
    };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { category } = Route.useParams();
  const fetchList = useServerFn(searchMobilityVehicles);
  const countiesFn = useServerFn(listCounties);
  const counties = useQuery({ queryKey: ["mkt-counties"], queryFn: () => countiesFn() });
  const [filters, setFilters] = useState<{ vehicleType?: MobilityVehicleType; make?: string; minSeats?: number; priceMaxKes?: number; transmission?: "automatic" | "manual"; county?: string; town?: string }>({});
  const debouncedTown = useDebouncedValue(filters.town ?? "", 350);
  const debouncedMake = useDebouncedValue(filters.make ?? "", 350);
  const { data, isLoading } = useQuery({
    queryKey: ["mobility-cat", category, { ...filters, town: debouncedTown, make: debouncedMake }],
    queryFn: () => fetchList({ data: { category: category as MobilityCategory, limit: 30, ...filters, town: debouncedTown || undefined, make: debouncedMake || undefined } }),
  });
  const vehicles = data?.vehicles ?? [];
  const label = MOBILITY_CATEGORY_LABELS[category as MobilityCategory];


  return (
    <div className="min-h-dvh bg-background">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <nav className="mb-3 text-sm text-muted-foreground">
          <Link to="/mobility" className="hover:underline">Mobility</Link> / <span>{label}</span>
        </nav>
        <h1 className="text-3xl font-semibold tracking-tight">{label}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">Browse available {label.toLowerCase()} across Kenya. Book directly through HostPulse.</p>

        <div className="mt-6 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
          <div>
            <Label className="text-xs">County</Label>
            <select className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              value={filters.county ?? ""}
              onChange={(e) => setFilters({ ...filters, county: e.target.value || undefined })}>
              <option value="">Any county</option>
              {(counties.data ?? []).map((c: any) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Town / city / area</Label>
            <Input className="mt-1" placeholder="e.g. Westlands" value={filters.town ?? ""} onChange={(e) => setFilters({ ...filters, town: e.target.value })} />
          </div>

          <div>
            <Label className="text-xs">Vehicle type</Label>
            <select className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              value={filters.vehicleType ?? ""}
              onChange={(e) => setFilters({ ...filters, vehicleType: (e.target.value || undefined) as any })}>
              <option value="">Any</option>
              {MOBILITY_VEHICLE_TYPES.map(t => <option key={t} value={t}>{MOBILITY_VEHICLE_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">Make</Label>
            <Input className="mt-1" placeholder="Toyota" value={filters.make ?? ""} onChange={(e) => setFilters({ ...filters, make: e.target.value || undefined })} />
          </div>
          <div>
            <Label className="text-xs">Min seats</Label>
            <Input className="mt-1" type="number" value={filters.minSeats ?? ""} onChange={(e) => setFilters({ ...filters, minSeats: e.target.value ? Number(e.target.value) : undefined })} />
          </div>
          <div>
            <Label className="text-xs">Max price / day (KES)</Label>
            <Input className="mt-1" type="number" value={filters.priceMaxKes ?? ""} onChange={(e) => setFilters({ ...filters, priceMaxKes: e.target.value ? Number(e.target.value) : undefined })} />
          </div>
          <div>
            <Label className="text-xs">Transmission</Label>
            <select className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              value={filters.transmission ?? ""}
              onChange={(e) => setFilters({ ...filters, transmission: (e.target.value || undefined) as any })}>
              <option value="">Any</option>
              <option value="automatic">Automatic</option>
              <option value="manual">Manual</option>
            </select>
          </div>
        </div>

        <div className="mt-8">
          {isLoading ? (
            <LoadingState label="Loading vehicles…" />
          ) : vehicles.length === 0 ? (
            <EmptyState title="No vehicles match" description="Try adjusting your filters." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {vehicles.map((v: any) => {
                const img = (v.mobility_vehicle_images ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order)[0];
                const dayRate = (v.mobility_vehicle_rates ?? []).find((r: any) => r.unit === "day");
                return (
                  <Link key={v.id} to="/mobility/v/$slug" params={{ slug: v.slug }}>
                    <Card className="h-full overflow-hidden transition-all hover:border-primary hover:shadow-md">
                      {img && <img src={img.url} alt={img.alt ?? `${v.make} ${v.model}`} className="h-40 w-full object-cover" loading="lazy" />}
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{v.make} {v.model} {v.year ? `(${v.year})` : ""}</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-muted-foreground space-y-1">
                        <div>{v.town ?? v.county_code ?? "Kenya"} · {v.seats ?? "?"} seats · {v.transmission ?? "-"}</div>
                        {dayRate && <div className="font-medium text-foreground">KES {Number(dayRate.price_kes).toLocaleString()} / day</div>}
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
