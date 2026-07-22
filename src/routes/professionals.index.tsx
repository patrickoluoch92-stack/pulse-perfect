import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { searchProfessionals, listProfessionalCategories } from "@/lib/professionals.functions";
import { listCounties } from "@/lib/marketplace.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, MapPin, Star, ShieldCheck } from "lucide-react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export const Route = createFileRoute("/professionals/")({
  head: () => ({
    meta: [
      { title: "Find Professionals — HostPulse" },
      {
        name: "description",
        content:
          "Browse and book verified photographers, event planners, tour guides, DJs, movers and more across Kenya on HostPulse.",
      },
      { property: "og:title", content: "HostPulse Professionals" },
      {
        property: "og:description",
        content: "Kenya's marketplace for verified professional services.",
      },
    ],
  }),
  component: ProfessionalsIndex,
});

function ProfessionalsIndex() {
  const fetchCats = useServerFn(listProfessionalCategories);
  const fetchSearch = useServerFn(searchProfessionals);
  const fetchCounties = useServerFn(listCounties);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string | undefined>();
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [countyCode, setCountyCode] = useState<string>("");
  const [location, setLocation] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);
  const debouncedLocation = useDebouncedValue(location, 300);

  const cats = useQuery({ queryKey: ["pro-cats"], queryFn: () => fetchCats() });
  const counties = useQuery({ queryKey: ["counties"], queryFn: () => fetchCounties() });
  const results = useQuery({
    queryKey: ["pro-search", debouncedQ, category, verifiedOnly, countyCode, debouncedLocation],
    queryFn: () =>
      fetchSearch({
        data: {
          q: debouncedQ || undefined,
          categorySlug: category,
          verifiedOnly,
          countyCode: countyCode || undefined,
          location: debouncedLocation || undefined,
          limit: 24,
          offset: 0,
        },
      }),
  });

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">HostPulse Professionals</h1>
          <p className="mt-2 text-muted-foreground">
            Book verified photographers, event planners, guides, DJs, movers and more across Kenya.
          </p>
          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Try 'wedding photographer in Nakuru'"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Button asChild>
              <Link to="/professionals/register">List your services</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Category chips */}
        <div className="mb-6 flex flex-wrap gap-2">
          <Button
            variant={!category ? "default" : "outline"}
            size="sm"
            onClick={() => setCategory(undefined)}
          >
            All
          </Button>
          {(cats.data ?? []).flatMap((p) =>
            p.children.map((c) => (
              <Button
                key={c.id}
                variant={category === c.slug ? "default" : "outline"}
                size="sm"
                onClick={() => setCategory(c.slug)}
              >
                {c.name}
              </Button>
            )),
          )}
          <Button
            variant={verifiedOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setVerifiedOnly((v) => !v)}
            className="ml-auto"
          >
            <ShieldCheck className="mr-1 h-4 w-4" /> Verified only
          </Button>
        </div>

        {/* Results grid */}
        {results.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading professionals…</p>
        ) : (results.data?.results.length ?? 0) === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <p className="text-muted-foreground">
              No professionals matched. Try a different search or category.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.data!.results.map((p: any) => (
              <Link key={p.id} to="/professionals/$slug" params={{ slug: p.slug ?? p.id }}>
                <Card className="h-full overflow-hidden transition hover:shadow-md">
                  <div className="aspect-[16/9] bg-muted">
                    {p.cover_image_path && (
                      <img
                        src={p.cover_image_path}
                        alt={p.business_name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="line-clamp-1 font-semibold">{p.business_name}</h3>
                      {p.is_verified && <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />}
                    </div>
                    {p.tagline && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.tagline}</p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {(p.town || p.county_code) && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {p.town ?? p.county_code}
                        </span>
                      )}
                      {p.avg_rating != null && (
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {Number(p.avg_rating).toFixed(1)} · {p.review_count}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      {p.starting_price != null ? (
                        <span className="text-sm font-medium">
                          From {p.currency ?? "KES"} {Number(p.starting_price).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Custom quote</span>
                      )}
                      {p.is_featured && <Badge variant="secondary">Featured</Badge>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
