import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Calendar, ChevronLeft, ChevronRight, Copy, Download, KeyRound, Loader2, Plus, RefreshCw, ShieldAlert, ShieldOff, Trash2 } from "lucide-react";


import { getWorkspaceContext } from "@/lib/workspace.functions";
import {
  listIcalSources, addIcalSource, deleteIcalSource, syncIcalSource,
  listExportableUnits, rotateIcalExportToken, setIcalTokenExpiry,
  revokeIcalToken, listIcalAccessLog, exportIcalAccessLog, getIcalSecurityAlerts,
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
  const exportLogFn = useServerFn(exportIcalAccessLog);

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
    mutationFn: (vars: { unitId: string; ttlDays?: number; unitName: string }) =>
      rotateFn({ data: { unitId: vars.unitId, ttlDays: vars.ttlDays } }).then((row) => ({ ...row, unitName: vars.unitName })),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["export-units"] });
      qc.invalidateQueries({ queryKey: ["ical-access-log"] });
      setRotateResult({
        unitId: row.id,
        unitName: row.unitName,
        url: `${origin}/api/public/ical/${row.ical_export_token}.ics`,
        expiresAt: row.ical_export_token_expires_at ?? null,
      });
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

  const [logPage, setLogPage] = useState(0);
  const [logStatus, setLogStatus] = useState<string>("all");
  const PAGE_SIZE = 25;

  const accessLog = useQuery({
    enabled: !!orgId,
    queryKey: ["ical-access-log", orgId, logPage, logStatus],
    queryFn: () => fetchLog({ data: {
      orgId: orgId!,
      limit: PAGE_SIZE,
      offset: logPage * PAGE_SIZE,
      status: logStatus === "all" ? undefined : logStatus,
    } }),
    refetchInterval: 30000,
  });

  const fetchAlerts = useServerFn(getIcalSecurityAlerts);
  const alerts = useQuery({
    enabled: !!orgId,
    queryKey: ["ical-security-alerts", orgId],
    queryFn: () => fetchAlerts({ data: { orgId: orgId! } }),
    refetchInterval: 60000,
  });

  // Rotation result dialog
  const [rotateResult, setRotateResult] = useState<
    | null
    | { unitId: string; unitName: string; url: string; expiresAt: string | null }
  >(null);
  const [pendingRotate, setPendingRotate] = useState<{ unitId: string; unitName: string } | null>(null);
  const [rotateTtl, setRotateTtl] = useState<string>("365");

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
            const expired = u.ical_export_token_expires_at
              ? new Date(u.ical_export_token_expires_at).getTime() < Date.now()
              : false;
            const feedUrl = u.ical_export_token && !expired
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
                      {expired ? (
                        <span className="text-destructive">Token expired — rotate to issue a new URL.</span>
                      ) : u.ical_export_token_expires_at ? (
                        <>Expires {new Date(u.ical_export_token_expires_at).toLocaleDateString()} · {daysUntil(u.ical_export_token_expires_at)} days left</>
                      ) : (
                        <span className="text-muted-foreground">No expiration set.</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Input readOnly value={feedUrl || (expired ? "Token expired — rotate to issue new URL" : "No token issued")} className="flex-1 font-mono text-xs" />
                  <Button variant="outline" size="sm" onClick={() => copy(feedUrl)} disabled={!feedUrl}>
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => setPendingRotate({ unitId: u.id, unitName: `${u.properties?.name ?? ""} · ${u.name}` })}
                    disabled={rotate.isPending}
                  >
                    {rotate.isPending && rotate.variables?.unitId === u.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <KeyRound className="h-3.5 w-3.5" />}
                    Rotate
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => {
                      const days = prompt("Extend expiration by how many days from now? (1-3650)", "365");
                      if (!days) return;
                      const n = parseInt(days, 10);
                      if (!Number.isFinite(n) || n < 1 || n > 3650) {
                        toast.error("Enter a number between 1 and 3650");
                        return;
                      }
                      updateExpiry.mutate({ unitId: u.id, ttlDays: n });
                    }}
                    disabled={updateExpiry.isPending}
                  >
                    Extend
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => {
                      if (confirm("Revoke this feed URL immediately?")) revoke.mutate(u.id);
                    }}
                    disabled={revoke.isPending || expired}
                  >
                    <ShieldOff className="h-3.5 w-3.5" /> Revoke
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

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold">Access log</h2>
              <p className="text-xs text-muted-foreground">
                Recent requests to your public export feeds. Refreshes every 30s.
              </p>
            </div>
            <Button
              variant="outline" size="sm"
              disabled={!orgId}
              onClick={async () => {
                try {
                  const res = await exportLogFn({ data: { orgId: orgId!, limit: 10000 } });
                  const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = res.filename;
                  a.click();
                  URL.revokeObjectURL(a.href);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Export failed");
                }
              }}
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
          <div className="overflow-hidden rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">When</th>
                  <th className="px-3 py-2 text-left">Unit</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">IP</th>
                  <th className="px-3 py-2 text-left">User-Agent</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const d = Array.isArray(accessLog.data) ? { rows: [], total: 0 } : (accessLog.data ?? { rows: [], total: 0 });
                  const rows = d.rows;
                  if (rows.length === 0) {
                    return (
                      <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">
                        No accesses match the current filter.
                      </td></tr>
                    );
                  }
                  return rows.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-3 py-2 text-xs">{timeAgo(row.created_at)}</td>
                      <td className="px-3 py-2 text-xs">{row.units?.name ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">
                        <span className={
                          row.status === "ok" ? "text-emerald-600" :
                          row.status === "expired" || row.status === "rate_limited" ? "text-amber-600" :
                          row.status === "rotated" || row.status === "revoked" ? "text-blue-600" :
                          "text-destructive"
                        }>{row.status}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{row.ip ?? "—"}</td>
                      <td className="px-3 py-2 truncate text-xs max-w-[20rem]">{row.user_agent ?? "—"}</td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
          {(() => {
            const d = Array.isArray(accessLog.data) ? { rows: [], total: 0 } : (accessLog.data ?? { rows: [], total: 0 });
            const total = d.total;
            const start = total === 0 ? 0 : logPage * PAGE_SIZE + 1;
            const end = Math.min(total, (logPage + 1) * PAGE_SIZE);
            const hasNext = end < total;
            return (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{total === 0 ? "0 of 0" : `${start}–${end} of ${total}`}</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={logPage === 0} onClick={() => setLogPage((p) => Math.max(0, p - 1))}>
                    <ChevronLeft className="h-3.5 w-3.5" /> Prev
                  </Button>
                  <Button variant="outline" size="sm" disabled={!hasNext} onClick={() => setLogPage((p) => p + 1)}>
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })()}
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

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}
