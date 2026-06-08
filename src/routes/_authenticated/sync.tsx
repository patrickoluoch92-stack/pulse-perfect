import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Bell, Calendar, Check, CheckCircle2, ChevronLeft, ChevronRight, Copy, Download, History, KeyRound, Loader2, Plus, RefreshCw, Save, Send, ShieldAlert, ShieldOff, Trash2, Webhook } from "lucide-react";


import { getWorkspaceContext } from "@/lib/workspace.functions";
import {
  listIcalSources, addIcalSource, deleteIcalSource, syncIcalSource,
  listExportableUnits, rotateIcalExportToken, setIcalTokenExpiry,
  revokeIcalToken, listIcalAccessLog, exportIcalAccessLog, getIcalSecurityAlerts,
  exportIcalSecurityAlerts, listIcalIncidents, updateIcalIncidentStatus,
  listIcalIncidentAudit, listIcalIncidentNotifications, markIcalIncidentNotificationsRead,
  listIcalIncidentWebhooks, addIcalIncidentWebhook, deleteIcalIncidentWebhook,
  testIcalIncidentWebhook, getIcalIncidentRetention, setIcalIncidentRetention,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  const exportAlertsFn = useServerFn(exportIcalSecurityAlerts);
  const fetchIncidents = useServerFn(listIcalIncidents);
  const updateIncidentFn = useServerFn(updateIcalIncidentStatus);
  const fetchAuditFn = useServerFn(listIcalIncidentAudit);
  const fetchNotifs = useServerFn(listIcalIncidentNotifications);
  const markReadFn = useServerFn(markIcalIncidentNotificationsRead);



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

  const incidents = useQuery({
    enabled: !!orgId,
    queryKey: ["ical-incidents", orgId],
    queryFn: () => fetchIncidents({ data: { orgId: orgId!, status: "open" } }),
    refetchInterval: 60000,
  });

  const updateIncident = useMutation({
    mutationFn: (vars: { id: string; status: "acknowledged" | "resolved" }) =>
      updateIncidentFn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ical-incidents"] });
      qc.invalidateQueries({ queryKey: ["ical-security-alerts"] });
      qc.invalidateQueries({ queryKey: ["ical-incident-notifs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const notifs = useQuery({
    enabled: !!orgId,
    queryKey: ["ical-incident-notifs", orgId],
    queryFn: () => fetchNotifs({ data: { orgId: orgId! } }),
    refetchInterval: 60000,
  });

  const markRead = useMutation({
    mutationFn: () => markReadFn({ data: { orgId: orgId! } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ical-incident-notifs"] });
      toast.success("Notifications marked as read");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [auditFor, setAuditFor] = useState<{ id: string; title: string } | null>(null);
  const audit = useQuery({
    enabled: !!auditFor,
    queryKey: ["ical-incident-audit", auditFor?.id],
    queryFn: () => fetchAuditFn({ data: { incidentId: auditFor!.id } }),
  });

  // Webhooks
  const fetchHooks = useServerFn(listIcalIncidentWebhooks);
  const addHookFn = useServerFn(addIcalIncidentWebhook);
  const delHookFn = useServerFn(deleteIcalIncidentWebhook);
  const testHookFn = useServerFn(testIcalIncidentWebhook);
  const hooks = useQuery({
    enabled: !!orgId,
    queryKey: ["ical-incident-webhooks", orgId],
    queryFn: () => fetchHooks({ data: { orgId: orgId! } }),
  });
  const [newHookUrl, setNewHookUrl] = useState("");
  const [revealedSecret, setRevealedSecret] = useState<{ url: string; secret: string } | null>(null);
  const addHook = useMutation({
    mutationFn: () => addHookFn({ data: { orgId: orgId!, url: newHookUrl.trim() } }),
    onSuccess: (row) => {
      toast.success("Webhook added");
      setNewHookUrl("");
      setRevealedSecret({ url: row.url, secret: row.secret });
      qc.invalidateQueries({ queryKey: ["ical-incident-webhooks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delHook = useMutation({
    mutationFn: (id: string) => delHookFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Webhook removed");
      qc.invalidateQueries({ queryKey: ["ical-incident-webhooks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const testHook = useMutation({
    mutationFn: (id: string) => testHookFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Test event sent");
      qc.invalidateQueries({ queryKey: ["ical-incident-webhooks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Retention
  const fetchRetention = useServerFn(getIcalIncidentRetention);
  const setRetentionFn = useServerFn(setIcalIncidentRetention);
  const retention = useQuery({
    enabled: !!orgId,
    queryKey: ["ical-incident-retention", orgId],
    queryFn: () => fetchRetention({ data: { orgId: orgId! } }),
  });
  const [retentionDays, setRetentionDays] = useState<string>("");
  const saveRetention = useMutation({
    mutationFn: () => {
      const n = parseInt(retentionDays, 10);
      if (!Number.isFinite(n) || n < 7 || n > 3650) throw new Error("Enter 7–3650 days");
      return setRetentionFn({ data: { orgId: orgId!, days: n } });
    },
    onSuccess: () => {
      toast.success("Retention updated");
      qc.invalidateQueries({ queryKey: ["ical-incident-retention"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });



  // Rotation result dialog
  const [rotateResult, setRotateResult] = useState<
    | null
    | { unitId: string; unitName: string; url: string; expiresAt: string | null }
  >(null);
  const [pendingRotate, setPendingRotate] = useState<{ unitId: string; unitName: string } | null>(null);
  const [rotateTtl, setRotateTtl] = useState<string>("365");

  // Extend / Revoke dialogs (replace prompt/confirm)
  const [pendingExtend, setPendingExtend] = useState<{ unitId: string; unitName: string } | null>(null);
  const [extendTtl, setExtendTtl] = useState<string>("365");
  const [pendingRevoke, setPendingRevoke] = useState<{ unitId: string; unitName: string } | null>(null);


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
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" disabled={!orgId} className="relative">
                  <Bell className="h-4 w-4" />
                  Alerts
                  {(notifs.data?.unread ?? 0) > 0 && (
                    <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                      {Math.min(99, notifs.data!.unread)}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[360px] p-0">
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <div className="text-sm font-medium">Incident notifications</div>
                  <Button
                    variant="ghost" size="sm"
                    disabled={(notifs.data?.unread ?? 0) === 0 || markRead.isPending}
                    onClick={() => markRead.mutate()}
                  >
                    Mark all read
                  </Button>
                </div>
                <div className="max-h-[420px] overflow-y-auto">
                  {!notifs.data || notifs.data.items.length === 0 ? (
                    <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                      No open incidents.
                    </p>
                  ) : (
                    <ul className="divide-y">
                      {notifs.data.items.map((n) => (
                        <li key={n.id} className={`flex gap-2 px-3 py-2 text-sm ${n.read ? "opacity-60" : ""}`}>
                          <span
                            className={
                              "mt-1 h-2 w-2 shrink-0 rounded-full " +
                              (n.severity === "high" ? "bg-destructive" : "bg-amber-500")
                            }
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="truncate text-xs font-medium capitalize">{n.kind}</span>
                              <span className="text-[10px] text-muted-foreground">{timeAgo(n.last_seen_at)}</span>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-3">{n.message}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <Button onClick={() => setOpen(true)} disabled={!orgId || (units.data?.length ?? 0) === 0}>
              <Plus className="h-4 w-4" /> Add import feed
            </Button>
          </div>


        </header>

        {alerts.data && alerts.data.alerts.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Security alerts
              </h2>
              <Button
                size="sm" variant="outline" disabled={!orgId}
                onClick={async () => {
                  try {
                    const res = await exportAlertsFn({ data: { orgId: orgId! } });
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
                <Download className="h-3.5 w-3.5" /> Export alerts
              </Button>
            </div>
            {alerts.data.alerts.map((a, i) => {
              const tone = a.severity === "high"
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
              const Icon = a.severity === "high" ? ShieldAlert : AlertTriangle;
              return (
                <div key={i} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${tone}`}>
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="flex-1">
                    <span className="font-medium capitalize">{a.severity}</span> · {a.message}
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground">
              Last 24h: {alerts.data.counts.total24h} requests · {alerts.data.counts.rateLimited1h} rate-limited (1h) ·{" "}
              {alerts.data.counts.badToken1h} bad-token (1h) · {alerts.data.counts.expired24h} expired-token hits
            </p>
          </div>
        )}

        {incidents.data && incidents.data.length > 0 && (
          <section className="space-y-2 rounded-xl border bg-card p-4 shadow-sm">
            <h2 className="font-display text-lg font-semibold">Open incidents</h2>
            <p className="text-xs text-muted-foreground">
              High-severity alerts open an incident automatically. Acknowledge to silence; resolve when handled.
            </p>
            <ul className="divide-y">
              {incidents.data.map((inc) => (
                <li key={inc.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase " +
                        (inc.severity === "high" ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-700 dark:text-amber-300")
                      }>{inc.severity}</span>
                      <span className="text-xs font-medium">{inc.kind}</span>
                      <span className="text-xs text-muted-foreground">· {inc.occurrences}× · last seen {timeAgo(inc.last_seen_at)}</span>
                      {inc.status === "acknowledged" && (
                        <span className="text-[10px] uppercase text-muted-foreground">acknowledged</span>
                      )}
                    </div>
                    <p className="mt-1 text-sm">{inc.message}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {inc.status === "open" && (
                      <Button size="sm" variant="outline"
                        onClick={() => updateIncident.mutate({ id: inc.id, status: "acknowledged" })}
                        disabled={updateIncident.isPending}>
                        <Check className="h-3.5 w-3.5" /> Ack
                      </Button>
                    )}
                    <Button size="sm" variant="ghost"
                      onClick={() => updateIncident.mutate({ id: inc.id, status: "resolved" })}
                      disabled={updateIncident.isPending}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                    </Button>
                    <Button size="sm" variant="ghost"
                      onClick={() => setAuditFor({ id: inc.id, title: `${inc.kind} · ${inc.severity}` })}
                      title="View audit trail">
                      <History className="h-3.5 w-3.5" /> Audit
                    </Button>

                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}



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
                      setExtendTtl("365");
                      setPendingExtend({ unitId: u.id, unitName: `${u.properties?.name ?? ""} · ${u.name}` });
                    }}
                    disabled={updateExpiry.isPending}
                  >
                    Extend
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => setPendingRevoke({ unitId: u.id, unitName: `${u.properties?.name ?? ""} · ${u.name}` })}
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
            <div className="flex flex-wrap items-center gap-2">
              <Select value={logStatus} onValueChange={(v) => { setLogStatus(v); setLogPage(0); }}>
                <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="ok">ok</SelectItem>
                  <SelectItem value="expired">expired</SelectItem>
                  <SelectItem value="rate_limited">rate_limited</SelectItem>
                  <SelectItem value="invalid_format">invalid_format</SelectItem>
                  <SelectItem value="not_found">not_found</SelectItem>
                  <SelectItem value="rotated">rotated</SelectItem>
                  <SelectItem value="revoked">revoked</SelectItem>
                </SelectContent>
              </Select>
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

      {/* Rotation confirm */}
      <Dialog open={!!pendingRotate} onOpenChange={(o) => !o && setPendingRotate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rotate iCal token</DialogTitle>
            <DialogDescription>
              {pendingRotate?.unitName}. Generates a new URL and immediately revokes the current one — any
              calendar still subscribed to the old URL will stop receiving updates until it&apos;s re-added.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>New expiration (days from now)</Label>
            <Input
              type="number" min={1} max={3650}
              value={rotateTtl}
              onChange={(e) => setRotateTtl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Between 1 and 3650.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingRotate(null)}>Cancel</Button>
            <Button
              disabled={rotate.isPending}
              onClick={() => {
                const n = parseInt(rotateTtl, 10);
                if (!Number.isFinite(n) || n < 1 || n > 3650) {
                  toast.error("Enter a number between 1 and 3650");
                  return;
                }
                const p = pendingRotate!;
                setPendingRotate(null);
                rotate.mutate({ unitId: p.unitId, unitName: p.unitName, ttlDays: n });
              }}
            >
              {rotate.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Rotate token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rotation result */}
      <Dialog open={!!rotateResult} onOpenChange={(o) => !o && setRotateResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New URL issued</DialogTitle>
            <DialogDescription>
              Update Airbnb / VRBO / Booking.com with the new URL below. The previous URL is now revoked.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Feed URL · {rotateResult?.unitName}</Label>
            <div className="flex items-center gap-2">
              <Input readOnly value={rotateResult?.url ?? ""} className="flex-1 font-mono text-xs" />
              <Button size="sm" onClick={() => rotateResult && copy(rotateResult.url)}>
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
            </div>
            {rotateResult?.expiresAt && (
              <p className="text-xs text-muted-foreground">
                Expires {new Date(rotateResult.expiresAt).toLocaleDateString()} ({daysUntil(rotateResult.expiresAt)} days).
              </p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setRotateResult(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend expiration */}
      <Dialog open={!!pendingExtend} onOpenChange={(o) => !o && setPendingExtend(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend expiration</DialogTitle>
            <DialogDescription>
              {pendingExtend?.unitName}. The existing URL keeps working; only the expiry date moves forward.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>New expiration (days from now)</Label>
            <Input type="number" min={1} max={3650}
              value={extendTtl} onChange={(e) => setExtendTtl(e.target.value)} />
            <p className="text-xs text-muted-foreground">Between 1 and 3650.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingExtend(null)}>Cancel</Button>
            <Button
              disabled={updateExpiry.isPending}
              onClick={() => {
                const n = parseInt(extendTtl, 10);
                if (!Number.isFinite(n) || n < 1 || n > 3650) {
                  toast.error("Enter a number between 1 and 3650");
                  return;
                }
                const p = pendingExtend!;
                setPendingExtend(null);
                updateExpiry.mutate({ unitId: p.unitId, ttlDays: n });
              }}
            >
              {updateExpiry.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Extend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirm */}
      <Dialog open={!!pendingRevoke} onOpenChange={(o) => !o && setPendingRevoke(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke feed URL</DialogTitle>
            <DialogDescription>
              {pendingRevoke?.unitName}. The current URL stops working immediately. Subscribers (Airbnb, VRBO…) will
              show stale data until you rotate and re-share a new URL.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingRevoke(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={revoke.isPending}
              onClick={() => {
                const p = pendingRevoke!;
                setPendingRevoke(null);
                revoke.mutate(p.unitId);
              }}
            >
              {revoke.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Revoke now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Incident audit trail */}
      <Dialog open={!!auditFor} onOpenChange={(o) => !o && setAuditFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Incident audit trail</DialogTitle>
            <DialogDescription>{auditFor?.title}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {audit.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {audit.data && audit.data.length === 0 && (
              <p className="text-sm text-muted-foreground">No audit entries yet.</p>
            )}
            <ul className="divide-y">
              {(audit.data ?? []).map((a) => (
                <li key={a.id} className="py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium capitalize">{a.action}</span>
                    <span className="text-xs text-muted-foreground">{timeAgo(a.created_at)}</span>
                  </div>
                  {a.note && <p className="mt-0.5 text-xs text-muted-foreground">{a.note}</p>}
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {a.actor_id ? `by ${a.actor_id.slice(0, 8)}…` : "system"}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAuditFor(null)}>Close</Button>
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
