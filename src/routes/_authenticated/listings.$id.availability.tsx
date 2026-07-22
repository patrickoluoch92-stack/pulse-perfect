import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Calendar as CalendarIcon } from "lucide-react";

import { authPageMeta } from "@/lib/route-meta";
import { getMyProperty } from "@/lib/marketplace.functions";
import {
  listAvailabilityBlocks,
  addAvailabilityBlock,
  removeAvailabilityBlock,
} from "@/lib/marketplace-ops.functions";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState, EmptyState } from "@/components/ui/states";

export const Route = createFileRoute("/_authenticated/listings/$id/availability")({
  head: () => ({
    meta: authPageMeta({ title: "Availability", description: "Block dates on a listing." }),
  }),
  component: AvailabilityPage,
});

function AvailabilityPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const getProp = useServerFn(getMyProperty);
  const listFn = useServerFn(listAvailabilityBlocks);
  const addFn = useServerFn(addAvailabilityBlock);
  const removeFn = useServerFn(removeAvailabilityBlock);

  const prop = useQuery({
    queryKey: ["mkt-my-prop", id],
    queryFn: () => getProp({ data: { id } }),
  });
  const blocks = useQuery({
    queryKey: ["mkt-blocks", id],
    queryFn: () => listFn({ data: { propertyId: id } }),
  });

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const add = useMutation({
    mutationFn: () =>
      addFn({ data: { propertyId: id, startDate, endDate, reason: reason || undefined } }),
    onSuccess: () => {
      toast.success("Dates blocked");
      setStartDate("");
      setEndDate("");
      setReason("");
      qc.invalidateQueries({ queryKey: ["mkt-blocks", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (bid: string) => removeFn({ data: { id: bid } }),
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["mkt-blocks", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DashboardShell>
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <div>
          <Link
            to="/listings"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> All listings
          </Link>
          <h1 className="mt-2 font-display text-3xl font-semibold">
            <CalendarIcon className="mr-2 inline h-7 w-7" />
            Availability — {prop.data?.name ?? "…"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Block off dates when this property cannot accept guests (renovations, owner stays,
            third-party bookings).
          </p>
        </div>

        <section className="space-y-4 rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Add a block</h2>
          <form
            className="grid gap-3 md:grid-cols-[1fr_1fr_2fr_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              if (!startDate || !endDate) return toast.error("Pick both dates");
              add.mutate();
            }}
          >
            <div className="space-y-1">
              <Label>From</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>To</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Reason (optional)</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
                placeholder="Maintenance, private booking…"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={add.isPending}>
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>
          </form>
        </section>

        <section className="rounded-xl border bg-card">
          <header className="border-b px-6 py-4">
            <h2 className="text-lg font-semibold">Blocked dates</h2>
          </header>
          {blocks.isLoading && <LoadingState label="Loading blocks…" />}
          {blocks.data && blocks.data.length === 0 && (
            <div className="p-6">
              <EmptyState
                icon={CalendarIcon}
                title="No blocks yet"
                description="The property is fully open for bookings."
              />
            </div>
          )}
          {blocks.data && blocks.data.length > 0 && (
            <ul className="divide-y">
              {blocks.data.map((b) => (
                <li key={b.id} className="flex items-center justify-between px-6 py-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {b.start_date} → {b.end_date}
                    </p>
                    {b.reason && <p className="text-xs text-muted-foreground">{b.reason}</p>}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => remove.mutate(b.id)}
                    disabled={remove.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
