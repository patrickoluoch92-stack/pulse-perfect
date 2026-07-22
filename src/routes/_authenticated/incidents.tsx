import { useMemo, useState } from "react";
import { authPageMeta } from "@/lib/route-meta";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAppErrors } from "@/lib/observability.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/states";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated/incidents")({
  head: () => ({
    meta: authPageMeta({
      title: "Incidents",
      description: "Server and client errors with correlation traces, filters, and time ranges.",
    }),
  }),
  component: IncidentsPage,
});

type Filters = {
  search: string;
  action: string;
  correlationId: string;
  source: string;
  level: "all" | "error" | "warn" | "info";
  sinceMinutes: number;
};

type Incident = Awaited<ReturnType<typeof listAppErrors>>["errors"][number];

function IncidentsPage() {
  const fetchErrors = useServerFn(listAppErrors);
  const [filters, setFilters] = useState<Filters>({
    search: "",
    action: "",
    correlationId: "",
    source: "",
    level: "all",
    sinceMinutes: 1440,
  });
  const [selected, setSelected] = useState<Incident | null>(null);

  const query = useQuery({
    queryKey: ["app_errors", filters],
    queryFn: () =>
      fetchErrors({
        data: {
          search: filters.search || undefined,
          action: filters.action || undefined,
          correlationId: filters.correlationId || undefined,
          source: filters.source || undefined,
          level: filters.level === "all" ? undefined : filters.level,
          sinceMinutes: filters.sinceMinutes,
          limit: 200,
        },
      }),
    refetchInterval: 30_000,
  });

  const rows = query.data?.errors ?? [];

  const groupedByCorrelation = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows)
      if (r.correlation_id) m.set(r.correlation_id, (m.get(r.correlation_id) ?? 0) + 1);
    return m;
  }, [rows]);

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Incidents</h1>
        <p className="text-sm text-muted-foreground">
          Server & client errors captured via the Sentry-style sink. Filter by action, correlation
          id, source, or time range.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Field label="Search message">
          <Input
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="text…"
          />
        </Field>
        <Field label="Action">
          <Input
            value={filters.action}
            onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
            placeholder="e.g. createInvitation"
          />
        </Field>
        <Field label="Correlation id">
          <Input
            value={filters.correlationId}
            onChange={(e) => setFilters((f) => ({ ...f, correlationId: e.target.value }))}
            placeholder="uuid…"
          />
        </Field>
        <Field label="Source">
          <Input
            value={filters.source}
            onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}
            placeholder="e.g. window.error"
          />
        </Field>
        <Field label="Level">
          <Select
            value={filters.level}
            onValueChange={(v) => setFilters((f) => ({ ...f, level: v as Filters["level"] }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="warn">Warn</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Time range">
          <Select
            value={String(filters.sinceMinutes)}
            onValueChange={(v) => setFilters((f) => ({ ...f, sinceMinutes: Number(v) }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">Last 15 min</SelectItem>
              <SelectItem value="60">Last hour</SelectItem>
              <SelectItem value="360">Last 6 h</SelectItem>
              <SelectItem value="1440">Last 24 h</SelectItem>
              <SelectItem value="10080">Last 7 d</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {query.isLoading ? "Loading…" : `${rows.length} incident${rows.length === 1 ? "" : "s"}`}
          {groupedByCorrelation.size > 0 &&
            ` · ${groupedByCorrelation.size} unique trace${groupedByCorrelation.size === 1 ? "" : "s"}`}
        </p>
        <Button variant="outline" size="sm" onClick={() => query.refetch()}>
          Refresh
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Trace</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge variant={r.level === "error" ? "destructive" : "secondary"}>
                    {r.level}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{r.action ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{r.source ?? "—"}</TableCell>
                <TableCell className="max-w-[420px] truncate">{r.message}</TableCell>
                <TableCell className="font-mono text-xs">
                  {r.correlation_id ? (
                    <button
                      className="underline-offset-2 hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFilters((f) => ({ ...f, correlationId: r.correlation_id! }));
                      }}
                    >
                      {r.correlation_id.slice(0, 8)}
                    </button>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
            {query.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8">
                  <LoadingState label="Loading incidents…" />
                </TableCell>
              </TableRow>
            )}
            {!query.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  No incidents match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="break-words">{selected.message}</SheetTitle>
                <SheetDescription>
                  {selected.action ?? "—"} · {selected.source ?? "—"} ·{" "}
                  {new Date(selected.created_at).toLocaleString()}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4 text-sm">
                {selected.correlation_id && (
                  <Section label="Correlation id">
                    <code className="text-xs">{selected.correlation_id}</code>
                  </Section>
                )}
                {selected.url && (
                  <Section label="URL">
                    <code className="text-xs break-all">{selected.url}</code>
                  </Section>
                )}
                {selected.stack && (
                  <Section label="Stack">
                    <pre className="max-h-80 overflow-auto rounded bg-muted p-3 text-xs">
                      {selected.stack}
                    </pre>
                  </Section>
                )}
                {selected.context && Object.keys(selected.context as object).length > 0 && (
                  <Section label="Context & breadcrumbs">
                    <pre className="max-h-96 overflow-auto rounded bg-muted p-3 text-xs">
                      {JSON.stringify(selected.context, null, 2)}
                    </pre>
                  </Section>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
