import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Landmark, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { authPageMeta } from "@/lib/route-meta";
import { formatCurrency } from "@/lib/format";
import {
  adminFinancialOverview, adminListPayouts,
  adminApprovePayout, adminMarkPayoutPaid, adminMarkPayoutFailed,
} from "@/lib/finance.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/finance")({
  head: () => ({ meta: authPageMeta({
    title: "Finance admin",
    description: "Platform revenue, commissions, and payouts.",
  }) }),
  component: FinanceAdmin,
});

function fmt(n: number, c = "KES") {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(Number(n || 0));
}

function FinanceAdmin() {
  const qc = useQueryClient();
  const overviewFn = useServerFn(adminFinancialOverview);
  const listPayoutsFn = useServerFn(adminListPayouts);
  const approveFn = useServerFn(adminApprovePayout);
  const paidFn = useServerFn(adminMarkPayoutPaid);
  const failFn = useServerFn(adminMarkPayoutFailed);

  const [status, setStatus] = useState<"requested" | "approved" | "processing" | "paid" | "failed" | "cancelled" | "all">("requested");
  const [payDialog, setPayDialog] = useState<{ id: string; open: boolean }>({ id: "", open: false });
  const [reference, setReference] = useState("");
  const [failDialog, setFailDialog] = useState<{ id: string; open: boolean }>({ id: "", open: false });
  const [reason, setReason] = useState("");

  const overview = useQuery({ queryKey: ["admin-finance-overview"], queryFn: () => overviewFn() });
  const payouts = useQuery({
    queryKey: ["admin-payouts", status],
    queryFn: () => listPayoutsFn({ data: { status, limit: 100 } }),
  });

  const approve = useMutation({
    mutationFn: (id: string) => approveFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Payout approved and funds held.");
      qc.invalidateQueries({ queryKey: ["admin-payouts"] });
      qc.invalidateQueries({ queryKey: ["admin-finance-overview"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const markPaid = useMutation({
    mutationFn: () => paidFn({ data: { id: payDialog.id, reference } }),
    onSuccess: () => {
      toast.success("Payout marked paid.");
      setPayDialog({ id: "", open: false }); setReference("");
      qc.invalidateQueries({ queryKey: ["admin-payouts"] });
      qc.invalidateQueries({ queryKey: ["admin-finance-overview"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const markFailed = useMutation({
    mutationFn: () => failFn({ data: { id: failDialog.id, reason } }),
    onSuccess: () => {
      toast.success("Payout marked failed and refunded.");
      setFailDialog({ id: "", open: false }); setReason("");
      qc.invalidateQueries({ queryKey: ["admin-payouts"] });
      qc.invalidateQueries({ queryKey: ["admin-finance-overview"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const o = overview.data;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold"><Landmark className="h-6 w-6" /> Finance admin</h1>
          <p className="text-sm text-muted-foreground">Platform revenue, wallet balances, and payout queue.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          qc.invalidateQueries({ queryKey: ["admin-finance-overview"] });
          qc.invalidateQueries({ queryKey: ["admin-payouts"] });
        }}><RefreshCw className="mr-1 h-4 w-4" /> Refresh</Button>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Platform commission (all time)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold text-primary">{fmt(o?.commissionsAllTime.commission ?? 0)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Gross booked: {fmt(o?.commissionsAllTime.gross ?? 0)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Commission (30d)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{fmt(o?.commissions30d.commission ?? 0)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Gross: {fmt(o?.commissions30d.gross ?? 0)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Taxes collected</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{fmt((o?.commissionsAllTime.vat ?? 0) + (o?.commissionsAllTime.levy ?? 0) + (o?.commissionsAllTime.service_fee ?? 0))}</p>
          <p className="mt-1 text-xs text-muted-foreground">VAT + Levy + Service fee</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Payouts</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{o?.payouts.requestedCount ?? 0} requested</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pending: {fmt(o?.payouts.pendingAmount ?? 0)} · Paid 30d: {fmt(o?.payouts.paid30d ?? 0)}
            </p>
          </CardContent></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Wallet available (all owners)</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-semibold">{fmt(o?.wallets.availableTotal ?? 0)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Wallet pending</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-semibold">{fmt(o?.wallets.pendingTotal ?? 0)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Lifetime earned by owners</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-semibold">{fmt(o?.wallets.lifetimeEarned ?? 0)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Lifetime paid out</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-semibold">{fmt(o?.wallets.lifetimePaidOut ?? 0)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Payout queue</CardTitle>
          <Select value={status} onValueChange={(v: any) => setStatus(v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="requested">Requested</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          {payouts.data?.rows?.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">No payouts in this state.</p>
          )}
          <ul className="divide-y">
            {payouts.data?.rows?.map((p: any) => {
              const dest = p.destination ?? {};
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{fmt(p.amount, p.currency)}</span>
                      <Badge variant={p.status === "paid" ? "default" : p.status === "failed" || p.status === "cancelled" ? "destructive" : "secondary"}>{p.status}</Badge>
                      <Badge variant="outline">{p.method}</Badge>
                      {p.organizations?.name && <Badge variant="outline">{p.organizations.name}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.method === "mpesa" ? `Phone: ${dest.phone ?? "—"}` : `${dest.bank_name ?? ""} · ${dest.account_number ?? "—"}`}
                      {" · "}Requested {new Date(p.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {p.status === "requested" && (
                      <Button size="sm" onClick={() => approve.mutate(p.id)} disabled={approve.isPending}>Approve & hold</Button>
                    )}
                    {(p.status === "approved" || p.status === "processing") && (
                      <>
                        <Button size="sm" variant="default" onClick={() => setPayDialog({ id: p.id, open: true })}>
                          <CheckCircle2 className="mr-1 h-4 w-4" /> Mark paid
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setFailDialog({ id: p.id, open: true })}>
                          <XCircle className="mr-1 h-4 w-4" /> Mark failed
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Dialog open={payDialog.open} onOpenChange={(o) => setPayDialog({ ...payDialog, open: o })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark payout paid</DialogTitle></DialogHeader>
          <div><Label>M-Pesa / bank reference</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. QHT7X9AB2Z" />
          </div>
          <DialogFooter><Button onClick={() => markPaid.mutate()} disabled={!reference || markPaid.isPending}>Confirm</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={failDialog.open} onOpenChange={(o) => setFailDialog({ ...failDialog, open: o })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark payout failed</DialogTitle></DialogHeader>
          <div><Label>Reason (refunds funds to owner)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for failure" />
          </div>
          <DialogFooter><Button variant="destructive" onClick={() => markFailed.mutate()} disabled={!reason || markFailed.isPending}>Confirm failure</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
