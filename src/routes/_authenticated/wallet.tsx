import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Wallet, ArrowDownToLine, RefreshCw, Ban } from "lucide-react";
import { authPageMeta } from "@/lib/route-meta";
import { getWorkspaceContext } from "@/lib/workspace.functions";
import {
  getWallet, listWalletLedger, listMyPayouts, requestPayout, cancelPayout, updatePayoutDestination,
} from "@/lib/finance.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/states";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({ meta: authPageMeta({
    title: "Wallet & Payouts",
    description: "Track your earnings, wallet balance, and request payouts to M-Pesa or bank.",
  }) }),
  component: WalletPage,
});

const fmt = (n: number | null | undefined, currency = "KES") => formatCurrency(n, currency);

function WalletPage() {
  const qc = useQueryClient();
  const ctxFn = useServerFn(getWorkspaceContext);
  const walletFn = useServerFn(getWallet);
  const ledgerFn = useServerFn(listWalletLedger);
  const payoutsFn = useServerFn(listMyPayouts);
  const requestFn = useServerFn(requestPayout);
  const cancelFn = useServerFn(cancelPayout);
  const destFn = useServerFn(updatePayoutDestination);

  const ctx = useQuery({ queryKey: ["workspace-context"], queryFn: () => ctxFn() });
  const orgId = ctx.data?.currentOrg?.id;

  const wallet = useQuery({
    queryKey: ["wallet", orgId],
    queryFn: () => walletFn({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });
  const ledger = useQuery({
    queryKey: ["ledger", orgId],
    queryFn: () => ledgerFn({ data: { orgId: orgId!, limit: 50 } }),
    enabled: !!orgId,
  });
  const payouts = useQuery({
    queryKey: ["payouts", orgId],
    queryFn: () => payoutsFn({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"mpesa" | "bank">("mpesa");
  const [phone, setPhone] = useState("");
  const [bankAcct, setBankAcct] = useState("");
  const [bankName, setBankName] = useState("");
  const [notes, setNotes] = useState("");

  const request = useMutation({
    mutationFn: () => requestFn({
      data: {
        orgId: orgId!,
        amount: Number(amount),
        method,
        destination: method === "mpesa"
          ? { phone }
          : { account_number: bankAcct, bank_name: bankName },
        notes: notes || undefined,
      },
    }),
    onSuccess: () => {
      toast.success("Payout requested — admin will review shortly.");
      setOpen(false); setAmount(""); setNotes("");
      qc.invalidateQueries({ queryKey: ["wallet", orgId] });
      qc.invalidateQueries({ queryKey: ["payouts", orgId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payouts", orgId] }),
  });

  const saveDest = useMutation({
    mutationFn: () => destFn({
      data: {
        orgId: orgId!, method,
        destination: method === "mpesa" ? { phone } : { account_number: bankAcct, bank_name: bankName },
      },
    }),
    onSuccess: () => {
      toast.success("Payout details saved.");
      qc.invalidateQueries({ queryKey: ["wallet", orgId] });
    },
  });

  const w = wallet.data as any;
  const currency = w?.currency ?? "KES";

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold"><Wallet className="h-6 w-6" /> Wallet & Payouts</h1>
          <p className="text-sm text-muted-foreground">Earnings from confirmed bookings settle to your wallet after guest check-out.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            qc.invalidateQueries({ queryKey: ["wallet", orgId] });
            qc.invalidateQueries({ queryKey: ["ledger", orgId] });
            qc.invalidateQueries({ queryKey: ["payouts", orgId] });
          }}><RefreshCw className="mr-1 h-4 w-4" /> Refresh</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={!w || Number(w?.available_balance) <= 0}>
                <ArrowDownToLine className="mr-1 h-4 w-4" /> Request payout
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Request payout</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Amount ({currency})</Label>
                  <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 5000" />
                  <p className="mt-1 text-xs text-muted-foreground">Available: {fmt(w?.available_balance, currency)}</p>
                </div>
                <div>
                  <Label>Method</Label>
                  <Select value={method} onValueChange={(v: any) => setMethod(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mpesa">M-Pesa</SelectItem>
                      <SelectItem value="bank">Bank transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {method === "mpesa" ? (
                  <div>
                    <Label>M-Pesa phone</Label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="2547XXXXXXXX" />
                  </div>
                ) : (
                  <>
                    <div><Label>Bank name</Label><Input value={bankName} onChange={(e) => setBankName(e.target.value)} /></div>
                    <div><Label>Account number</Label><Input value={bankAcct} onChange={(e) => setBankAcct(e.target.value)} /></div>
                  </>
                )}
                <div><Label>Notes (optional)</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
              </div>
              <DialogFooter className="flex-col gap-2 sm:flex-row">
                <Button variant="ghost" onClick={() => saveDest.mutate()} disabled={saveDest.isPending}>Save details only</Button>
                <Button onClick={() => request.mutate()} disabled={request.isPending || !amount}>Submit request</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Available</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold text-primary">{fmt(w?.available_balance, currency)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pending settlement</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{fmt(w?.pending_balance, currency)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Lifetime earned</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{fmt(w?.lifetime_earned, currency)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Lifetime paid out</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{fmt(w?.lifetime_paid_out, currency)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Payout history</CardTitle></CardHeader>
        <CardContent className="p-0">
          {payouts.data?.rows?.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">No payouts yet.</p>
          )}
          <ul className="divide-y">
            {payouts.data?.rows?.map((p: any) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{fmt(p.amount, p.currency)}</span>
                    <Badge variant={p.status === "paid" ? "default" : p.status === "failed" || p.status === "cancelled" ? "destructive" : "secondary"}>
                      {p.status}
                    </Badge>
                    <Badge variant="outline">{p.method}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Requested {new Date(p.created_at).toLocaleString()}
                    {p.external_reference && ` · ref ${p.external_reference}`}
                    {p.failure_reason && ` · reason: ${p.failure_reason}`}
                  </p>
                </div>
                {p.status === "requested" && (
                  <Button variant="ghost" size="sm" onClick={() => cancel.mutate(p.id)}>
                    <Ban className="mr-1 h-4 w-4" /> Cancel
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent wallet activity</CardTitle></CardHeader>
        <CardContent className="p-0">
          {ledger.data?.rows?.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">No activity yet.</p>
          )}
          <ul className="divide-y">
            {ledger.data?.rows?.map((e: any) => (
              <li key={e.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={e.entry_type === "credit" ? "text-primary font-medium" : "text-destructive font-medium"}>
                      {e.entry_type === "credit" ? "+" : "−"} {fmt(e.amount, currency)}
                    </span>
                    <Badge variant="outline" className="capitalize">{e.category.replace("_", " ")}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{e.description ?? "—"} · {new Date(e.created_at).toLocaleString()}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>Available: {fmt(e.available_after, currency)}</div>
                  <div>Pending: {fmt(e.pending_after, currency)}</div>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
