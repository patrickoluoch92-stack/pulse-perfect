import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getProfessionalBySlug } from "@/lib/professionals.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Star, ShieldCheck, Phone, MessageCircle, Mail, Globe } from "lucide-react";

export const Route = createFileRoute("/professionals/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Professional Profile — HostPulse` },
      { name: "description", content: `Book this professional on HostPulse.` },
      { property: "og:title", content: `${params.slug} · HostPulse Professionals` },
    ],
  }),
  component: ProfessionalProfile,
});

function ProfessionalProfile() {
  const { slug } = Route.useParams();
  const fetchOne = useServerFn(getProfessionalBySlug);
  const q = useQuery({
    queryKey: ["professional", slug],
    queryFn: () => fetchOne({ data: { slug } }),
  });

  if (q.isLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  const data = q.data;
  if (!data) throw notFound();
  const p = data.professional;

  return (
    <div className="min-h-dvh bg-background">
      {/* Cover */}
      <div className="relative h-56 bg-muted md:h-80">
        {p.cover_image_path && (
          <img
            src={p.cover_image_path}
            alt={p.business_name}
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="-mt-16 rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-card bg-muted">
              {p.profile_image_path && (
                <img
                  src={p.profile_image_path}
                  alt={p.business_name}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold">{p.business_name}</h1>
                {p.is_verified && (
                  <Badge className="gap-1">
                    <ShieldCheck className="h-3 w-3" /> Verified
                  </Badge>
                )}
                {p.is_top_rated && <Badge variant="secondary">Top rated</Badge>}
                {p.is_featured && <Badge variant="secondary">Featured</Badge>}
              </div>
              {p.tagline && <p className="mt-1 text-muted-foreground">{p.tagline}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {(p.town || p.county_code) && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4" />{" "}
                    {[p.town, p.county_code].filter(Boolean).join(", ")}
                  </span>
                )}
                {p.avg_rating != null && (
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    {Number(p.avg_rating).toFixed(1)} · {p.review_count} reviews
                  </span>
                )}
                {p.years_experience && <span>{p.years_experience}+ years experience</span>}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button asChild size="lg">
                <Link to="/professionals/$slug/book" params={{ slug }}>
                  Book now
                </Link>
              </Button>
              {p.whatsapp && (
                <a
                  href={`https://wa.me/${p.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button variant="outline" size="lg" className="w-full">
                    <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {p.ai_summary && (
              <Card className="ai-surface">
                <CardHeader>
                  <CardTitle className="text-base">AI Summary</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">{p.ai_summary}</CardContent>
              </Card>
            )}
            {p.description && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">About</CardTitle>
                </CardHeader>
                <CardContent className="whitespace-pre-line text-sm text-muted-foreground">
                  {p.description}
                </CardContent>
              </Card>
            )}

            {data.services.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Services</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.services.map((s: any) => (
                    <div
                      key={s.id}
                      className="flex items-start justify-between border-b pb-3 last:border-0"
                    >
                      <div>
                        <div className="font-medium">{s.title}</div>
                        {s.description && (
                          <div className="text-sm text-muted-foreground">{s.description}</div>
                        )}
                      </div>
                      {s.base_price != null && (
                        <div className="text-sm font-medium">
                          {p.currency ?? "KES"} {Number(s.base_price).toLocaleString()}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {data.packages.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Packages</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  {data.packages.map((pk: any) => (
                    <div key={pk.id} className="rounded border p-4">
                      <div className="font-semibold">{pk.name}</div>
                      {pk.duration_label && (
                        <div className="text-xs text-muted-foreground">{pk.duration_label}</div>
                      )}
                      <div className="mt-2 text-lg font-bold">
                        {p.currency ?? "KES"} {Number(pk.price).toLocaleString()}
                      </div>
                      {pk.description && (
                        <p className="mt-2 text-sm text-muted-foreground">{pk.description}</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {data.portfolio.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Portfolio</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                    {data.portfolio.slice(0, 12).map((item: any) => (
                      <div key={item.id} className="aspect-square overflow-hidden rounded bg-muted">
                        {item.media_url || item.media_path ? (
                          <img
                            src={item.media_url ?? item.media_path}
                            alt={item.title ?? ""}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {data.reviews.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Reviews</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {data.reviews.slice(0, 10).map((r: any) => (
                    <div key={r.id} className="border-b pb-3 last:border-0">
                      <div className="flex items-center gap-2 text-sm">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        <span className="font-medium">{r.rating.toFixed(1)}</span>
                        {r.title && <span className="text-muted-foreground">· {r.title}</span>}
                      </div>
                      {r.body && <p className="mt-1 text-sm">{r.body}</p>}
                      {r.professional_response && (
                        <div className="mt-2 rounded bg-muted p-2 text-sm">
                          <span className="font-medium">Response: </span>
                          {r.professional_response}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {p.phone && (
                  <a href={`tel:${p.phone}`} className="flex items-center gap-2 hover:underline">
                    <Phone className="h-4 w-4" /> {p.phone}
                  </a>
                )}
                {p.email && (
                  <a href={`mailto:${p.email}`} className="flex items-center gap-2 hover:underline">
                    <Mail className="h-4 w-4" /> {p.email}
                  </a>
                )}
                {p.website && (
                  <a
                    href={p.website}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 hover:underline"
                  >
                    <Globe className="h-4 w-4" /> Website
                  </a>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Coverage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                {p.nationwide && <div>✓ Serves nationwide</div>}
                {p.online_services && <div>✓ Online services available</div>}
                {p.travels_to_clients && (
                  <div>
                    ✓ Travels to clients{p.max_travel_km ? ` (up to ${p.max_travel_km} km)` : ""}
                  </div>
                )}
                {p.emergency_bookings && <div>✓ Emergency bookings accepted</div>}
                <div>Booking lead time: {p.booking_lead_hours ?? 24}h</div>
              </CardContent>
            </Card>
            {p.cancellation_policy && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Cancellation</CardTitle>
                </CardHeader>
                <CardContent className="whitespace-pre-line text-sm text-muted-foreground">
                  {p.cancellation_policy}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
