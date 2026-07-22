import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Search, ShieldCheck, Car } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState } from "@/components/ui/states";
import { listPublicMobilityProviders } from "@/lib/mobility.functions";

export const Route = createFileRoute("/mobility/companies")({
  component: CompaniesDirectory,
  head: () => ({
    meta: [
      { title: "Verified Car Hire Companies — HostPulse" },
      {
        name: "description",
        content: "Browse verified car hire, chauffeur and safari transport companies across Kenya.",
      },
    ],
  }),
});

function CompaniesDirectory() {
  const fetchProviders = useServerFn(listPublicMobilityProviders);
  const [q, setQ] = useState("");
  const query = useQuery({
    queryKey: ["public-mobility-providers", q],
    queryFn: () => fetchProviders({ data: { query: q || undefined, limit: 40 } }),
  });
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-3xl font-semibold">
          <Car className="h-7 w-7" /> Verified car hire companies
        </h1>
        <p className="text-muted-foreground">
          Trusted fleets across Kenya — self-drive, chauffeur, safari and luxury transport.
        </p>
      </header>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search companies…"
          className="pl-9"
        />
      </div>
      {query.isLoading ? (
        <LoadingState label="Loading companies…" />
      ) : (query.data?.providers ?? []).length === 0 ? (
        <EmptyState title="No companies match" description="Try a different search." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {query.data!.providers.map((p: any) => (
            <Link key={p.id} to="/mobility/company/$slug" params={{ slug: p.slug }}>
              <Card className="h-full overflow-hidden transition hover:shadow-md">
                {p.cover_image_url && (
                  <img src={p.cover_image_url} alt="" className="h-32 w-full object-cover" />
                )}
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {p.logo_url ? (
                      <img src={p.logo_url} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 font-semibold">
                        <span className="truncate">{p.name}</span>
                        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {p.town ?? "Kenya"}
                        {p.rating_avg ? ` · ★ ${Number(p.rating_avg).toFixed(1)}` : ""}
                      </div>
                    </div>
                  </div>
                  {p.bio && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.bio}</p>
                  )}
                  {(p.service_categories ?? []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(p.service_categories as string[]).slice(0, 3).map((c) => (
                        <Badge key={c} variant="outline" className="text-xs">
                          {c.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
