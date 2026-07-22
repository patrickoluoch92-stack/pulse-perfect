import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { listMyBookings, setBookingStatus } from "@/lib/marketplace-extra.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState, EmptyState } from "@/components/ui/states";

export const Route = createFileRoute("/_authenticated/bookings")({
  component: MyBookings,
});

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  confirmed: "default",
  cancelled: "destructive",
  completed: "outline",
};

function MyBookings() {
  const qc = useQueryClient();
  const fetchBookings = useServerFn(listMyBookings);
  const cancel = useServerFn(setBookingStatus);

  const { data = [], isLoading } = useQuery({
    queryKey: ["my-bookings"],
    queryFn: () => fetchBookings(),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancel({ data: { id, status: "cancelled" } }),
    onSuccess: () => {
      toast.success("Booking cancelled");
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My bookings</h1>
        <p className="text-sm text-muted-foreground">
          Your marketplace stays. Hosts confirm requests within 24 hours.
        </p>
      </div>

      {isLoading && <LoadingState label="Loading bookings…" />}
      {!isLoading && data.length === 0 && (
        <EmptyState
          title="No bookings yet"
          description="Your marketplace stays will appear here once you book."
          action={
            <Button asChild>
              <Link to="/marketplace">Browse marketplace</Link>
            </Button>
          }
        />
      )}

      <div className="space-y-3">
        {data.map((b: any) => (
          <Card key={b.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link
                  to="/marketplace/p/$slug"
                  params={{ slug: b.marketplace_properties?.slug ?? "" }}
                  className="font-semibold hover:underline"
                >
                  {b.marketplace_properties?.name ?? "Property"}
                </Link>
                <p className="text-sm text-muted-foreground">{b.marketplace_properties?.town}</p>
                <p className="mt-1 text-sm">
                  {new Date(b.check_in).toLocaleDateString()} –{" "}
                  {new Date(b.check_out).toLocaleDateString()} · {b.guests_count} guest
                  {b.guests_count > 1 ? "s" : ""}
                </p>
              </div>
              <div className="text-right">
                <Badge variant={statusVariant[b.status] ?? "secondary"}>{b.status}</Badge>
                <p className="mt-2 text-sm font-semibold">
                  {b.currency} {Number(b.total_amount).toLocaleString()}
                </p>
                {b.status === "pending" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1"
                    onClick={() => cancelMutation.mutate(b.id)}
                    disabled={cancelMutation.isPending}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
