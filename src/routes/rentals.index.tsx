import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, ArrowRight } from "lucide-react";
import { listCategoryTree } from "@/lib/taxonomy.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanWithAI } from "@/components/plan-with-ai";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

export const Route = createFileRoute("/rentals/")({
  head: () => ({
    meta: [
      { title: "Rental Houses & Commercial Properties in Kenya | HostPulse" },
      { name: "description", content: "Browse bedsitters, apartments, maisonettes, townhouses, office spaces and more across Kenya. Filter by county, town, and budget." },
      { property: "og:title", content: "Rental Houses in Kenya" },
      { property: "og:description", content: "Find rentals and commercial spaces across Kenya's 47 counties." },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "/rentals" }],
  }),
  component: RentalsHub,
});

function RentalsHub() {
  const fetchTree = useServerFn(listCategoryTree);
  const { data, isLoading, isError, error } = useQuery({ queryKey: ["taxonomy-tree"], queryFn: () => fetchTree() });

  const parent = (data?.tree ?? []).find(n => n.slug === "commercial-rental-houses");
  const children = parent?.children ?? [];

  return (
    <div className="min-h-dvh bg-background">
      <section className="border-b bg-gradient-to-b from-primary/5 to-transparent">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <nav className="mb-4 text-sm text-muted-foreground">
            <Link to="/" className="hover:underline">Home</Link> / <span>Rentals</span>
          </nav>
          <h1 className="flex items-center gap-3 text-4xl font-semibold tracking-tight">
            <Building2 className="h-9 w-9 text-primary" /> Commercial / Rental Houses
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
            {parent?.description ?? "Residential and commercial rentals across Kenya. Choose a property type to see listings by county, town, and budget."}
          </p>
          <div className="mt-6">
            <PlanWithAI
              seed={{ module: "rental", seed_intent: "Help me find a rental in Kenya within my budget" }}
              label="Plan your rental with AI"
              variant="default"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="mb-6 text-xl font-semibold">Choose a property type</h2>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {children.map((c) => (
            <Link key={c.slug} to="/rentals/$child" params={{ child: c.slug }} aria-label={`Browse ${c.name}`}>
              <Card className="h-full transition-all hover:border-primary hover:shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    {c.name}
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Browse {c.name.toLowerCase()} listings across Kenya.</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
        {isLoading && children.length === 0 && <div className="mt-6"><LoadingState label="Loading categories…" /></div>}
        {isError && children.length === 0 && (
          <div className="mt-6"><ErrorState description={error instanceof Error ? error.message : "Unable to load property categories."} /></div>
        )}
        {!isLoading && !isError && children.length === 0 && (
          <div className="mt-6"><EmptyState title="No property types yet" description="Categories are being seeded — check back soon." /></div>
        )}
      </section>
    </div>
  );
}
