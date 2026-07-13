import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listWishlist, toggleWishlist } from "@/lib/wishlist.functions";
import { getLoyalty } from "@/lib/loyalty.functions";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, Trash2 } from "lucide-react";
import { LoadingState, EmptyState } from "@/components/ui/states";

export const Route = createFileRoute("/_authenticated/wishlist")({
  head: () => ({
    meta: [
      { title: "Wishlist & Loyalty · HostPulse" },
      { name: "description", content: "Your saved properties and HostPulse loyalty points." },
    ],
  }),
  component: WishlistPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-8">
      <p className="text-destructive">{error.message}</p>
      <Button onClick={reset} className="mt-3">Retry</Button>
    </div>
  ),
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

function WishlistPage() {
  const router = useRouter();
  const list = useServerFn(listWishlist);
  const toggle = useServerFn(toggleWishlist);
  const loyalty = useServerFn(getLoyalty);

  const wishlistQ = useQuery({ queryKey: ["wishlist"], queryFn: () => list() });
  const loyaltyQ = useQuery({ queryKey: ["loyalty"], queryFn: () => loyalty() });

  async function remove(propertyId: string) {
    await toggle({ data: { propertyId } });
    router.invalidate();
  }

  return (
    <DashboardShell>
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Heart className="h-6 w-6 text-primary" />
          <h1 className="font-display text-3xl font-semibold">Wishlist &amp; Loyalty</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Loyalty balance</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Points</p>
              <p className="mt-1 font-display text-2xl">{loyaltyQ.data?.account?.points_balance ?? 0}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Tier</p>
              <p className="mt-1 font-display text-2xl capitalize">{loyaltyQ.data?.account?.tier ?? "bronze"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Lifetime</p>
              <p className="mt-1 font-display text-2xl">{loyaltyQ.data?.account?.lifetime_points ?? 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saved properties</CardTitle>
          </CardHeader>
          <CardContent>
            {wishlistQ.isLoading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : (wishlistQ.data?.items ?? []).length === 0 ? (
              <p className="text-muted-foreground">
                Nothing saved yet. Browse the <Link to="/listings" className="underline">marketplace</Link> and tap the heart.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(wishlistQ.data!.items as any[]).map((it) => {
                  const p = it.marketplace_properties;
                  if (!p) return null;
                  return (
                    <div key={it.id} className="overflow-hidden rounded-lg border">
                      {p.cover_image_url ? (
                        <img src={p.cover_image_url} alt={p.title} className="aspect-video w-full object-cover" />
                      ) : (
                        <div className="aspect-video w-full bg-muted" />
                      )}
                      <div className="space-y-2 p-3">
                        <p className="font-medium">{p.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.town ?? p.county_code} · from {p.currency ?? "KES"} {p.price_from ?? "—"}
                        </p>
                        <div className="flex gap-2">
                          <Button asChild size="sm" variant="outline" className="flex-1">
                            <Link to="/discover/$slug" params={{ slug: p.slug }}>View</Link>
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => remove(p.id)} aria-label="Remove">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent points activity</CardTitle>
          </CardHeader>
          <CardContent>
            {(loyaltyQ.data?.ledger ?? []).length === 0 ? (
              <p className="text-muted-foreground">No points activity yet.</p>
            ) : (
              <ul className="divide-y">
                {loyaltyQ.data!.ledger.map((e: any) => (
                  <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{e.reason}</span>
                    <span className={e.delta >= 0 ? "text-primary" : "text-destructive"}>
                      {e.delta >= 0 ? "+" : ""}
                      {e.delta}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
