import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { MapPin, ExternalLink, Star } from "lucide-react";

import { getPublicProperty } from "@/lib/marketplace.functions";
import { categoryLabel } from "@/lib/marketplace-constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PropertyReviews } from "@/components/PropertyReviews";
import { BookingDialog } from "@/components/BookingDialog";
import { PlanWithAI } from "@/components/plan-with-ai";
import { formatCurrency } from "@/lib/format";

const propQuery = (slug: string) =>
  queryOptions({
    queryKey: ["mkt-public", slug],
    queryFn: () => getPublicProperty({ data: { slug } }),
  });

export const Route = createFileRoute("/marketplace/p/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(propQuery(params.slug));
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Property not found" }] };
    const title = `${loaderData.name} — ${loaderData.county?.name ?? "Kenya"} | HostPulse`;
    const description = loaderData.description.slice(0, 155);
    const meta = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: loaderData.name },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
    ];
    if (loaderData.main_image_url) {
      meta.push(
        { property: "og:image", content: loaderData.main_image_url },
        { name: "twitter:image", content: loaderData.main_image_url },
        { name: "twitter:card", content: "summary_large_image" },
      );
    }
    return {
      meta,
      links: [
        { rel: "canonical", href: `/marketplace/p/${loaderData.slug}` },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LodgingBusiness",
            name: loaderData.name,
            description: loaderData.description,
            address: {
              "@type": "PostalAddress",
              addressLocality: loaderData.town,
              addressRegion: loaderData.county?.name,
              addressCountry: "KE",
            },
            ...(loaderData.latitude && loaderData.longitude
              ? {
                  geo: {
                    "@type": "GeoCoordinates",
                    latitude: loaderData.latitude,
                    longitude: loaderData.longitude,
                  },
                }
              : {}),
            ...(loaderData.main_image_url ? { image: loaderData.main_image_url } : {}),
            ...(loaderData.price_per_night
              ? {
                  priceRange: `${loaderData.currency} ${loaderData.price_per_night}`,
                }
              : {}),
          }),
        },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl p-12 text-center">
      <h1 className="text-2xl font-semibold">Listing not found</h1>
      <Link to="/marketplace" className="mt-4 inline-block text-primary">Back to marketplace</Link>
    </div>
  ),
  errorComponent: ({ error, reset }) => (
    <div className="mx-auto max-w-2xl p-12 text-center">
      <h1 className="text-2xl font-semibold">Could not load listing</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <button onClick={reset} className="mt-4 text-primary underline">Retry</button>
    </div>
  ),
  component: PropertyDetail,
});

function PropertyDetail() {
  const params = Route.useParams();
  const { data: prop } = useSuspenseQuery(propQuery(params.slug));
  const [activeImage, setActiveImage] = useState(0);

  if (!prop) return null;

  const images = [
    ...(prop.main_image_url ? [{ id: "main", url: prop.main_image_url, alt_text: prop.name }] : []),
    ...prop.gallery.filter((g) => g.url),
  ];

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <Link to="/marketplace" className="text-sm text-muted-foreground hover:text-foreground">
            ← Marketplace
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{categoryLabel(prop.category)}</Badge>
            <span>·</span>
            <Link
              to="/marketplace/$county"
              params={{ county: prop.county?.slug ?? "" }}
              className="hover:text-foreground"
            >
              {prop.town}, {prop.county?.name}
            </Link>
            {prop.is_featured && <Badge className="bg-yellow-500 hover:bg-yellow-500">Featured</Badge>}
            {((prop as any).rating_count ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-sm">
                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                <span className="font-medium">{Number((prop as any).rating_avg ?? 0).toFixed(1)}</span>
                <span className="text-muted-foreground">({(prop as any).rating_count})</span>
              </span>
            )}
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            {prop.name}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <PlanWithAI
              seed={{
                module: "travel",
                property_slug: prop.slug,
                county: prop.county?.name,
                seed_intent: `Plan a trip to stay at ${prop.name} in ${prop.town ?? prop.county?.name ?? "Kenya"}`,
              }}
              label="Plan a trip with AI"
            />
          </div>
        </div>

        {images.length > 0 && (
          <div className="mb-8 grid gap-3 md:grid-cols-[2fr_1fr]">
            <div className="aspect-[4/3] overflow-hidden rounded-xl bg-muted">
              <img
                src={images[activeImage]?.url ?? undefined}
                alt={images[activeImage]?.alt_text ?? prop.name}
                className="h-full w-full object-cover"
              />
            </div>
            {images.length > 1 && (
              <div className="grid grid-cols-3 gap-2 md:grid-cols-2">
                {images.slice(0, 4).map((img, i) => (
                  <button
                    key={img.id}
                    type="button"
                    aria-label={`Show image ${i + 1}${img.alt_text ? `: ${img.alt_text}` : ""}`}
                    aria-pressed={activeImage === i}
                    onClick={() => setActiveImage(i)}
                    className={`aspect-square overflow-hidden rounded-lg border-2 transition ${
                      activeImage === i ? "border-primary" : "border-transparent"
                    }`}
                  >
                    <img
                      src={img.url ?? undefined}
                      alt={img.alt_text ?? ""}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid gap-8 md:grid-cols-[2fr_1fr]">
          <div>
            <section>
              <h2 className="text-xl font-semibold">About this stay</h2>
              <p className="mt-3 whitespace-pre-line text-muted-foreground">{prop.description}</p>
            </section>

            {prop.amenities.length > 0 && (
              <section className="mt-8">
                <h2 className="text-xl font-semibold">Amenities</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {prop.amenities.map((a) => (
                    <Badge key={a} variant="secondary">{a}</Badge>
                  ))}
                </div>
              </section>
            )}

            {(prop.latitude && prop.longitude) || prop.google_maps_url ? (
              <section className="mt-8">
                <h2 className="text-xl font-semibold">Location</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {prop.town}, {prop.county?.name} county
                </p>
                {prop.latitude && prop.longitude && import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY ? (
                  <div className="mt-3 overflow-hidden rounded-lg border">
                    <iframe
                      title={`Map of ${prop.name}`}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      className="h-72 w-full"
                      src={`https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY}&q=${prop.latitude},${prop.longitude}&zoom=14`}
                    />
                  </div>
                ) : null}
                {prop.google_maps_url && (
                  <Button asChild variant="outline" className="mt-3">
                    <a href={prop.google_maps_url} target="_blank" rel="noopener noreferrer">
                      <MapPin className="mr-2 h-4 w-4" /> Open in Google Maps
                      <ExternalLink className="ml-2 h-3 w-3" />
                    </a>
                  </Button>
                )}
                {prop.latitude && prop.longitude && (
                  <Button asChild variant="outline" className="mt-3 ml-2">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${prop.latitude},${prop.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MapPin className="mr-2 h-4 w-4" /> Get directions
                    </a>
                  </Button>
                )}
              </section>
            ) : null}
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border bg-card p-5">
              {prop.price_per_night != null && (
                <p className="text-lg">
                  <span className="text-2xl font-semibold">
                    {prop.currency} {Number(prop.price_per_night).toLocaleString()}
                  </span>
                  <span className="ml-1 text-muted-foreground">/ night</span>
                </p>
              )}
              <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                {prop.availability === "available"
                  ? "Available now"
                  : prop.availability === "limited"
                    ? "Limited availability"
                    : "Currently booked out"}
              </p>

              {prop.availability !== "booked_out" && (
                <div className="mt-4">
                  <BookingDialog
                    propertyId={prop.id}
                    propertyName={prop.name}
                    pricePerNight={prop.price_per_night != null ? Number(prop.price_per_night) : null}
                    currency={prop.currency ?? "KES"}
                  />
                </div>
              )}

              <div className="mt-4 space-y-2 border-t pt-4">
                <h3 className="text-sm font-semibold">Contact host</h3>
                <p className="text-sm text-muted-foreground">
                  Send a booking request to share contact details with the host.
                </p>
              </div>
            </div>
          </aside>
        </div>

        <PropertyReviews
          propertyId={prop.id}
          ratingAvg={(prop as any).rating_avg ?? 0}
          ratingCount={(prop as any).rating_count ?? 0}
        />
      </article>
    </div>
  );
}
