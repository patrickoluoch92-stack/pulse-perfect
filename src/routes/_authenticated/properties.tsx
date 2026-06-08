import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWorkspaceContext, listProperties } from "@/lib/workspace.functions";
import { Button } from "@/components/ui/button";
import { BedDouble, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/properties")({
  head: () => ({ meta: [{ title: "Properties — HostPulse" }] }),
  component: PropertiesPage,
});

function PropertiesPage() {
  const fetchCtx = useServerFn(getWorkspaceContext);
  const fetchProps = useServerFn(listProperties);
  const ctx = useQuery({ queryKey: ["workspace-context"], queryFn: () => fetchCtx() });
  const orgId = ctx.data?.currentOrg?.id;
  const props = useQuery({
    queryKey: ["properties", orgId],
    queryFn: () => fetchProps({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Properties</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hotels, lodges, vacation rentals, and tour listings in your workspace.
          </p>
        </div>
        <Button disabled>
          <Plus className="mr-2 h-4 w-4" /> New property
        </Button>
      </header>

      {props.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (props.data?.length ?? 0) === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {props.data!.map((p) => (
            <div key={p.id} className="rounded-2xl border border-border/60 bg-card p-5">
              <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <BedDouble className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-semibold">{p.name}</h3>
              <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                {p.type.replace("_", " ")}
              </p>
              {(p.city || p.country) && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {[p.city, p.country].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
        <BedDouble className="h-6 w-6" />
      </div>
      <h3 className="font-display text-xl font-semibold">No properties yet</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Add your first property to start tracking units, availability, and bookings.
      </p>
    </div>
  );
}
