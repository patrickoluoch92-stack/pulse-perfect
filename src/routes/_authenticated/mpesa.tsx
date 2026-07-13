import { authPageMeta } from "@/lib/route-meta";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { RefreshCcw, Smartphone } from "lucide-react";
import { LoadingState, EmptyState } from "@/components/ui/states";

import { getWorkspaceContext } from "@/lib/workspace.functions";
import { listMpesaTransactions } from "@/lib/mpesa.functions";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/mpesa")({
  head: () => ({ meta: authPageMeta({ title: "M-PESA payments", description: "Review STK Push transactions, receipts, and payment status across your organization." }) }),
  component: MpesaAdminPage,
});

const statusColors: Record<string, string> = {
  SUCCESS: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
  FAILED: "bg-rose-100 text-rose-900 dark:bg-rose-900/30 dark:text-rose-200",
  PENDING: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
};

function MpesaAdminPage() {
  const fetchCtx = useServerFn(getWorkspaceContext);
  const fetchTx = useServerFn(listMpesaTransactions);
  const ctx = useQuery({ queryKey: ["workspace-context"], queryFn: () => fetchCtx() });
  const orgId = ctx.data?.currentOrg?.id;

  const [filter, setFilter] = useState<string>("all");

  const tx = useQuery({
    queryKey: ["mpesa-transactions", orgId],
    queryFn: () => fetchTx({ data: { orgId: orgId! } }),
    enabled: !!orgId,
    refetchInterval: 15_000,
  });

  const rows = (tx.data ?? []).filter((t) => filter === "all" || t.status === filter);
  const totalSucceeded = (tx.data ?? [])
    .filter((t) => t.status === "SUCCESS")
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const pendingCount = (tx.data ?? []).filter((t) => t.status === "PENDING").length;
  const failedCount = (tx.data ?? []).filter((t) => t.status === "FAILED").length;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">M-PESA payments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            STK Push transactions across this organization. Auto-refreshes every 15s.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="SUCCESS">Succeeded</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => tx.refetch()} disabled={tx.isFetching}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${tx.isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Total collected" value={`KES ${totalSucceeded.toLocaleString()}`} />
        <Stat label="Pending" value={pendingCount.toString()} />
        <Stat label="Failed" value={failedCount.toString()} />
      </div>

      {tx.isLoading ? (
        <LoadingState label="Loading transactions…" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Smartphone}
          title="No M-PESA transactions yet"
          description="STK Push attempts started from pricing or invoices will appear here."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Receipt</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Linked</th>
                <th className="px-4 py-3">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(t.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{t.phone_number ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    KES {Number(t.amount ?? 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{t.mpesa_receipt_number ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusColors[t.status ?? ""] ?? "bg-muted"}`}>
                      {t.status ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {t.invoice_id ? "Invoice" : t.subscription_id ? "Subscription" : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{t.result_desc ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
