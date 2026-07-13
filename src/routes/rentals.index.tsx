import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, ArrowRight } from "lucide-react";
import { listCategoryTree } from "@/lib/taxonomy.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="mb-6 text-xl font-semibold">Choose a property type</h2>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {children.map((c) => (
            <Link key={c.slug} to="/rentals/$child" params={{ child: c.slug }}>
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
          {isLoading && children.length === 0 && <p className="text-sm text-muted-foreground">Loading categories…</p>}
          {isError && children.length === 0 && (
            <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Unable to load property categories."}</p>
          )}
          {!isLoading && !isError && children.length === 0 && (
            <p className="text-sm text-muted-foreground">No property types are available yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
