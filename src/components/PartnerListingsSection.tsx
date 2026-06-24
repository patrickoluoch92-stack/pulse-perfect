import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, MapPin, Star } from "lucide-react";

import { listPartnerListings } from "@/lib/external-inventory.functions";
import { Badge } from "@/components/ui/badge";

type Props = {
  countyCode?: string;
  title?: string;
  description?: string;
  limit?: number;
};

export function PartnerListingsSection({
  countyCode,
  title = "More stays from our partners",
  description = "Inventory pulled live from Booking.com and Expedia. Bookings happen on the partner site.",
  limit = 12,
}: Props) {
  const fn = useServerFn(listPartnerListings);
  const { data, isLoading } = useQuery({
    queryKey: ["partner-listings", countyCode ?? "all", limit],
    queryFn: () => fn({ data: { countyCode, limit } }),
    staleTime: 60 * 1000,
  });

  if (!isLoading && (!data || data.rows.length === 0)) return null;

  return (
    <section className="border-t bg-card/40">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-1 flex items-end justify-between">
          <h2 className="text-2xl font-semibold">{title}</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">{description}</p>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data!.rows.map((p) => (
              <a
                key={`${p.provider}-${p.external_id}`}
                href={p.deeplink_url}
                target="_blank"
                rel="nofollow noopener noreferrer sponsored"
                className="group overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-lg"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-muted-foreground">
                      <MapPin className="h-8 w-8" />
                    </div>
                  )}
                  <Badge className="absolute left-3 top-3 capitalize">{p.provider}</Badge>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold leading-tight">{p.name}</h3>
                    <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>
                  <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                    {p.town ?? p.country_code}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    {p.price_per_night != null ? (
                      <span className="font-semibold">
                        {p.currency} {Math.round(Number(p.price_per_night)).toLocaleString()}
                        <span className="font-normal text-muted-foreground"> / night</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">See rate on site</span>
                    )}
                    {p.rating != null && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                        {Number(p.rating).toFixed(1)}
                        {p.review_count ? (
                          <span className="text-xs">({p.review_count})</span>
                        ) : null}
                      </span>
                    )}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
