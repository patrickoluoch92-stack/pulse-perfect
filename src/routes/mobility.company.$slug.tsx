import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, Phone, Mail, Globe, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState } from "@/components/ui/states";
import { getPublicMobilityProvider } from "@/lib/mobility.functions";

export const Route = createFileRoute("/mobility/company/$slug")({
  component: CompanyPage,
});

function CompanyPage() {
  const { slug } = Route.useParams();
  const fetch = useServerFn(getPublicMobilityProvider);
  const q = useQuery({
    queryKey: ["public-mobility-company", slug],
    queryFn: () => fetch({ data: { slug } }),
  });
  const p: any = q.data?.provider;
  if (q.isLoading)
    return (
      <div className="p-6">
        <LoadingState label="Loading company…" />
      </div>
    );
  if (!p)
    return (
      <div className="p-6">
        <EmptyState title="Company not found" description="It may not be verified yet." />
      </div>
    );
  const vehicles = q.data?.vehicles ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {p.cover_image_url && (
        <img src={p.cover_image_url} alt="" className="h-48 w-full rounded-lg object-cover" />
      )}
      <header className="flex flex-wrap items-start gap-4">
        {p.logo_url ? (
          <img src={p.logo_url} alt="" className="h-16 w-16 rounded-md object-cover" />
        ) : (
          <div className="h-16 w-16 rounded-md bg-muted" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            {p.name} <ShieldCheck className="h-5 w-5 text-primary" />
          </h1>
          <p className="text-sm text-muted-foreground">
            {p.town ?? "Kenya"}
            {p.rating_avg ? ` · ★ ${Number(p.rating_avg).toFixed(1)} (${p.rating_count})` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
            {p.contact_phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {p.contact_phone}
              </span>
            )}
            {p.contact_email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {p.contact_email}
              </span>
            )}
            {p.website && (
              <a
                href={p.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:underline"
              >
                <Globe className="h-3.5 w-3.5" />
                Website
              </a>
            )}
            {p.address && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {p.address}
              </span>
            )}
          </div>
        </div>
      </header>
      {p.bio && <p className="max-w-3xl text-muted-foreground">{p.bio}</p>}

      <section>
        <h2 className="mb-3 text-xl font-semibold">Fleet ({vehicles.length})</h2>
        {vehicles.length === 0 ? (
          <EmptyState title="No published vehicles" description="Check back soon." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vehicles.map((v: any) => {
              const rate = (v.mobility_vehicle_rates ?? []).find((r: any) => r.unit === "day");
              return (
                <Link key={v.id} to="/mobility/v/$slug" params={{ slug: v.slug }}>
                  <Card className="h-full overflow-hidden transition hover:shadow-md">
                    {v.main_image_url && (
                      <img src={v.main_image_url} alt="" className="h-40 w-full object-cover" />
                    )}
                    <CardContent className="p-4">
                      <div className="font-semibold">
                        {v.make} {v.model} {v.year ? `(${v.year})` : ""}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">{String(v.category).replace(/_/g, " ")}</Badge>
                        {v.seats && <span>{v.seats} seats</span>}
                        {v.transmission && <span>{v.transmission}</span>}
                      </div>
                      {rate && (
                        <div className="mt-2 text-sm font-medium">
                          From KES {Number(rate.price_kes).toLocaleString()}/day
                        </div>
                      )}
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
