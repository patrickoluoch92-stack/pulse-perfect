import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Calendar, Copy, KeyRound, Loader2, Plus, RefreshCw, ShieldOff, Trash2 } from "lucide-react";


import { getWorkspaceContext } from "@/lib/workspace.functions";
import {
  listIcalSources, addIcalSource, deleteIcalSource, syncIcalSource,
  listExportableUnits, rotateIcalExportToken, setIcalTokenExpiry,
  revokeIcalToken, listIcalAccessLog,
} from "@/lib/ical.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/sync")({
  head: () => ({ meta: [{ title: "Calendar Sync — HostPulse" }] }),
  component: SyncPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

function SyncPage() {
  const qc = useQueryClient();
  const fetchCtx = useServerFn(getWorkspaceContext);
  const fetchUnits = useServerFn(listExportableUnits);
  const fetchSources = useServerFn(listIcalSources);
  const addFn = useServerFn(addIcalSource);
  const delFn = useServerFn(deleteIcalSource);
  const syncFn = useServerFn(syncIcalSource);
  const rotateFn = useServerFn(rotateIcalExportToken);
  const setExpiryFn = useServerFn(setIcalTokenExpiry);
  const revokeFn = useServerFn(revokeIcalToken);
  const fetchLog = useServerFn(listIcalAccessLog);

  const ctx = useQuery({ queryKey: ["workspace-context"], queryFn: () => fetchCtx() });
  const orgId = ctx.data?.currentOrg?.id;

  const units = useQuery({
    enabled: !!orgId,
    queryKey: ["export-units", orgId],
    queryFn: () => fetchUnits({ data: { orgId: orgId! } }),
  });

  const sources = useQuery({
    enabled: !!orgId,
    queryKey: ["ical-sources", orgId],
    queryFn: () => fetchSources({ data: { orgId: orgId! } }),
  });

  const [open, setOpen] = useState(false);
  const [unitId, setUnitId] = useState<string>("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const add = useMutation({
    mutationFn: () => addFn({ data: { orgId: orgId!, unitId, name, url } }),
    onSuccess: () => {
      toast.success("Calendar added");
      setOpen(false); setName(""); setUrl(""); setUnitId("");
      qc.invalidateQueries({ queryKey: ["ical-sources"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["ical-sources"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sync = useMutation({
    mutationFn: (id: string) => syncFn({ data: { id } }),
    onSuccess: (res) => {
      toast.success(`Synced ${res.count} event${res.count === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["ical-sources"] });
    },
    onError: (e: Error) => toast.error(`Sync failed: ${e.message}`),
  });

  const rotate = useMutation({
    mutationFn: (vars: { unitId: string; ttlDays?: number }) =>
      rotateFn({ data: vars }),
    onSuccess: () => {
      toast.success("Token rotated. Old feed URL is now revoked.");
      qc.invalidateQueries({ queryKey: ["export-units"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateExpiry = useMutation({
    mutationFn: (vars: { unitId: string; ttlDays: number | null }) =>
      setExpiryFn({ data: vars }),
    onSuccess: () => {
      toast.success("Expiration updated");
      qc.invalidateQueries({ queryKey: ["export-units"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (unitId: string) => revokeFn({ data: { unitId } }),
    onSuccess: () => {
      toast.success("Token revoked");
      qc.invalidateQueries({ queryKey: ["export-units"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const accessLog = useQuery({
    enabled: !!orgId,
    queryKey: ["ical-access-log", orgId],
    queryFn: () => fetchLog({ data: { orgId: orgId!, limit: 50 } }),
    refetchInterval: 30000,
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success("Copied to clipboard"),
      () => toast.error("Could not copy"),
    );
  }

  const grouped = new Map<string, typeof sources.data>();
  for (const s of sources.data ?? []) {
    const arr = grouped.get(s.unit_id) ?? [];
    arr.push(s);
    grouped.set(s.unit_id, arr);
  }

  return (
    <>
      <div className="mx-auto max-w-5xl space-y-8 p-6 md:p-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Calendar Sync</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Share availability with Airbnb, VRBO &amp; Booking.com via iCal. Import their feeds to block dates here.
            </p>
          </div>
          <Button onClick={() => setOpen(true)} disabled={!orgId || (units.data?.length ?? 0) === 0}>
            <Plus className="h-4 w-4" /> Add import feed
          </Button>
        </header>

        <section className="space-y-4">
          {(units.data ?? []).map((u) => {
            const feedUrl = u.ical_export_token
              ? `${origin}/api/public/ical/${u.ical_export_token}.ics`
              : "";
            const unitSources = grouped.get(u.id) ?? [];
            return (
              <div key={u.id} className="rounded-xl border bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-medium">
                      {u.properties?.name} · {u.name}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Signed export feed — anyone with this URL can read availability.
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Input readOnly value={feedUrl} className="flex-1 font-mono text-xs" />
                  <Button variant="outline" size="sm" onClick={() => copy(feedUrl)}>
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => {
                      if (confirm("Rotate token? Any calendar subscribed to the current URL will stop syncing.")) {
                        rotate.mutate(u.id);
                      }
                    }}
                    disabled={rotate.isPending}
                  >
                    {rotate.isPending && rotate.variables === u.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <KeyRound className="h-3.5 w-3.5" />}
                    Rotate
                  </Button>
                </div>

                <div className="mt-5 border-t pt-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <Calendar className="h-4 w-4" /> Imported calendars
                  </div>
                  {unitSources.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No external calendars connected for this unit.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {unitSources.map((s) => (
                        <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{s.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{s.url}</p>
                            <p className="mt-0.5 text-xs">
                              {s.last_status === "ok" && (
                                <span className="text-emerald-600">
                                  {s.event_count} events · synced {timeAgo(s.last_synced_at)}
                                </span>
                              )}
                              {s.last_status === "error" && (
                                <span className="text-destructive">Error: {s.last_error}</span>
                              )}
                              {!s.last_status && <span className="text-muted-foreground">Never synced</span>}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm" variant="outline"
                              onClick={() => sync.mutate(s.id)}
                              disabled={sync.isPending}
                            >
                              {sync.isPending && sync.variables === s.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <RefreshCw className="h-3.5 w-3.5" />}
                              Sync now
                            </Button>
                            <Button
                              size="sm" variant="ghost"
                              onClick={() => remove.mutate(s.id)}
                              disabled={remove.isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
          {units.data && units.data.length === 0 && (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Add a property &amp; unit first to enable calendar sync.
            </p>
          )}
        </section>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add external calendar</DialogTitle>
            <DialogDescription>
              Paste the iCal URL from Airbnb, VRBO, or Booking.com. We&apos;ll import their events as blocked dates.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger><SelectValue placeholder="Choose a unit" /></SelectTrigger>
                <SelectContent>
                  {(units.data ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.properties?.name} · {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Airbnb" />
            </div>
            <div className="space-y-1.5">
              <Label>iCal URL</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.airbnb.com/calendar/ical/..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => add.mutate()}
              disabled={add.isPending || !unitId || !name.trim() || !url.trim()}
            >
              {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
