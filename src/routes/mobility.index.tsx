import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Car, ArrowRight, Building2 } from "lucide-react";
import { searchMobilityVehicles, MOBILITY_CATEGORIES, MOBILITY_CATEGORY_LABELS, type MobilityCategory } from "@/lib/mobility.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanWithAI } from "@/components/plan-with-ai";
import { LoadingState, EmptyState } from "@/components/ui/states";

export const Route = createFileRoute("/mobility/")({
  head: () => ({
    meta: [
      { title: "Car Hire & Mobility in Kenya | HostPulse" },
      { name: "description", content: "Self-drive rentals, chauffeur services, airport transfers, safari 4x4s, tour vans, luxury cars and more across Kenya. Book on HostPulse." },
      { property: "og:title", content: "Car Hire & Mobility in Kenya" },
      { property: "og:description", content: "Rent cars, safari vehicles, buses, motorcycles, and boats across Kenya on HostPulse." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/mobility" }],
  }),
  component: MobilityHub,
});

function MobilityHub() {
  const fetchFeatured = useServerFn(searchMobilityVehicles);
  const { data, isLoading } = useQuery({
    queryKey: ["mobility-featured"],
    queryFn: () => fetchFeatured({ data: { limit: 8 } }),
  });
  const vehicles = data?.vehicles ?? [];

  return (
    <div className="min-h-dvh bg-background">
      <section className="border-b bg-gradient-to-b from-primary/5 to-transparent">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <nav className="mb-4 text-sm text-muted-foreground">
            <Link to="/" className="hover:underline">Home</Link> / <span>Mobility</span>
          </nav>
          <h1 className="flex items-center gap-3 text-4xl font-semibold tracking-tight">
            <Car className="h-9 w-9 text-primary" /> Car Hire & Mobility
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
            Book self-drive cars, chauffeur services, safari 4x4s, tour vans, shuttles, motorcycles, and more — integrated with HostPulse stays and itineraries.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <PlanWithAI
              seed={{ module: "travel", seed_intent: "Plan a trip with transport included" }}
              label="Plan your trip with AI"
              variant="default"
            />
            <Link
              to="/mobility/companies"
              className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium hover:border-primary hover:text-primary"
            >
              <Building2 className="h-4 w-4" /> Browse rental companies
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="mb-6 text-xl font-semibold">Browse by category</h2>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {(MOBILITY_CATEGORIES as readonly MobilityCategory[]).map((c) => (
            <Link key={c} to="/mobility/$category" params={{ category: c }} aria-label={`Browse ${MOBILITY_CATEGORY_LABELS[c]}`}>
              <Card className="h-full transition-all hover:border-primary hover:shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    {MOBILITY_CATEGORY_LABELS[c]}
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Browse {MOBILITY_CATEGORY_LABELS[c].toLowerCase()} across Kenya.</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <h2 className="mb-6 text-xl font-semibold">Featured vehicles</h2>
        {isLoading ? (
          <LoadingState label="Loading vehicles…" />
        ) : vehicles.length === 0 ? (
          <EmptyState title="No vehicles yet" description="Providers are being onboarded — check back soon." />
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
                      <div>{MOBILITY_CATEGORY_LABELS[v.category as MobilityCategory] ?? v.category}</div>
                      <div>{v.town ?? v.county_code ?? "Kenya"} · {v.seats ?? "?"} seats · {v.transmission ?? "-"}</div>
                      {dayRate && <div className="font-medium text-foreground">KES {Number(dayRate.price_kes).toLocaleString()} / day</div>}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
