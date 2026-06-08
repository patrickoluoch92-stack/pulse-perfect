import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

import { getWorkspaceContext } from "@/lib/workspace.functions";
import { listGuests } from "@/lib/reservations.functions";
import { getInvoice, upsertInvoice, INVOICE_STATUSES } from "@/lib/invoices.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/invoices/$invoiceId")({
  head: () => ({ meta: [{ title: "Invoice — HostPulse" }] }),
  component: InvoiceEditorPage,
});

type LineItem = { description: string; quantity: number; unit_price: number };

const schema = z.object({
  status: z.enum(INVOICE_STATUSES),
  issued_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_at: z.string().optional().or(z.literal("")),
  currency: z.string().trim().min(3).max(3),
  tax_amount: z.coerce.number().min(0),
  notes: z.string().trim().max(2000),
  guest_id: z.string().uuid().optional().or(z.literal("")),
  items: z.array(z.object({
    description: z.string().trim().min(1, "Required"),
    quantity: z.coerce.number().min(0),
    unit_price: z.coerce.number().min(0),
  })).min(1, "Add at least one item"),
});
type FormValues = z.infer<typeof schema>;

const emptyForm = (): FormValues => ({
  status: "draft",
  issued_at: new Date().toISOString().slice(0, 10),
  due_at: "",
  currency: "USD",
  tax_amount: 0,
  notes: "",
  guest_id: "",
  items: [{ description: "", quantity: 1, unit_price: 0 }],
});

function InvoiceEditorPage() {
  const { invoiceId } = useParams({ strict: false }) as { invoiceId: string };
  const isNew = invoiceId === "new";
  const navigate = useNavigate();

  const fetchCtx = useServerFn(getWorkspaceContext);
  const fetchInv = useServerFn(getInvoice);
  const fetchGuests = useServerFn(listGuests);
  const saveFn = useServerFn(upsertInvoice);

  const ctx = useQuery({ queryKey: ["workspace-context"], queryFn: () => fetchCtx() });
  const orgId = ctx.data?.currentOrg?.id;

  const guests = useQuery({
    queryKey: ["guests", orgId], enabled: !!orgId,
    queryFn: () => fetchGuests({ data: { orgId: orgId! } }),
  });

  const existing = useQuery({
    queryKey: ["invoice", invoiceId], enabled: !isNew,
    queryFn: () => fetchInv({ data: { id: invoiceId } }),
  });

  const [values, setValues] = useState<FormValues>(emptyForm());
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  useEffect(() => {
    if (!existing.data) return;
    const inv = existing.data.invoice;
    setValues({
      status: inv.status,
      issued_at: inv.issued_at,
      due_at: inv.due_at ?? "",
      currency: inv.currency,
      tax_amount: Number(inv.tax_amount),
      notes: inv.notes ?? "",
      guest_id: inv.guest_id ?? "",
      items: existing.data.items.length
        ? existing.data.items.map((it) => ({
            description: it.description,
            quantity: Number(it.quantity),
            unit_price: Number(it.unit_price),
          }))
        : [{ description: "", quantity: 1, unit_price: 0 }],
    });
    setReservationId(inv.reservation_id);
  }, [existing.data]);

  const subtotal = values.items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0);
  const total = subtotal + (Number(values.tax_amount) || 0);

  const saveMut = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          orgId: orgId!,
          id: isNew ? undefined : invoiceId,
          reservation_id: reservationId ?? null,
          guest_id: values.guest_id || null,
          status: values.status,
          issued_at: values.issued_at,
          due_at: values.due_at || "",
          currency: values.currency,
          tax_amount: values.tax_amount,
          notes: values.notes,
          items: values.items,
        },
      }),
    onSuccess: (row) => {
      toast.success(isNew ? "Invoice created" : "Invoice saved");
      if (isNew) navigate({ to: "/invoices/$invoiceId", params: { invoiceId: row.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit() {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const i of parsed.error.issues) {
        fe[i.path.join(".")] = i.message;
      }
      setErrors(fe); return;
    }
    setErrors({});
    saveMut.mutate();
  }

  function setItem(idx: number, patch: Partial<LineItem>) {
    setValues((v) => ({ ...v, items: v.items.map((it, i) => i === idx ? { ...it, ...patch } : it) }));
  }
  function addItem() {
    setValues((v) => ({ ...v, items: [...v.items, { description: "", quantity: 1, unit_price: 0 }] }));
  }
  function removeItem(idx: number) {
    setValues((v) => ({ ...v, items: v.items.length > 1 ? v.items.filter((_, i) => i !== idx) : v.items }));
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate({ to: "/invoices" })} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to invoices
        </button>
        {!isNew && existing.data && (
          <span className="font-mono text-sm text-muted-foreground">{existing.data.invoice.number}</span>
        )}
      </div>

      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {isNew ? "New invoice" : existing.data?.invoice.number ?? "Invoice"}
        </h1>
      </header>

      <section className="grid gap-4 rounded-2xl border border-border/60 bg-card p-6 md:grid-cols-2">
        <Field label="Guest">
          <Select value={values.guest_id || ""} onValueChange={(v) => setValues((s) => ({ ...s, guest_id: v }))}>
            <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
            <SelectContent>
              {(guests.data ?? []).map((g) => (
                <SelectItem key={g.id} value={g.id}>{g.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Status">
          <Select value={values.status} onValueChange={(v) => setValues((s) => ({ ...s, status: v as FormValues["status"] }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {INVOICE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Issued" error={errors.issued_at}>
          <Input type="date" value={values.issued_at} onChange={(e) => setValues((s) => ({ ...s, issued_at: e.target.value }))} />
        </Field>
        <Field label="Due">
          <Input type="date" value={values.due_at} onChange={(e) => setValues((s) => ({ ...s, due_at: e.target.value }))} />
        </Field>
        <Field label="Currency">
          <Input value={values.currency} maxLength={3} onChange={(e) => setValues((s) => ({ ...s, currency: e.target.value.toUpperCase() }))} />
        </Field>
        <Field label="Tax amount">
          <Input type="number" min={0} step="0.01" value={values.tax_amount} onChange={(e) => setValues((s) => ({ ...s, tax_amount: Number(e.target.value) }))} />
        </Field>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
          <h2 className="font-medium">Line items</h2>
          <Button size="sm" variant="outline" onClick={addItem}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add item
          </Button>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-border/60 bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2 w-24 text-right">Qty</th>
              <th className="px-4 py-2 w-32 text-right">Unit price</th>
              <th className="px-4 py-2 w-32 text-right">Amount</th>
              <th className="px-4 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {values.items.map((it, idx) => (
              <tr key={idx}>
                <td className="px-4 py-2">
                  <Input value={it.description} onChange={(e) => setItem(idx, { description: e.target.value })} placeholder="e.g. Nightly rate × 3" />
                </td>
                <td className="px-4 py-2"><Input type="number" min={0} step="0.01" value={it.quantity} onChange={(e) => setItem(idx, { quantity: Number(e.target.value) })} className="text-right" /></td>
                <td className="px-4 py-2"><Input type="number" min={0} step="0.01" value={it.unit_price} onChange={(e) => setItem(idx, { unit_price: Number(e.target.value) })} className="text-right" /></td>
                <td className="px-4 py-2 text-right tabular-nums">{((Number(it.quantity) || 0) * (Number(it.unit_price) || 0)).toFixed(2)}</td>
                <td className="px-4 py-2 text-right">
                  <Button size="icon" variant="ghost" onClick={() => removeItem(idx)} aria-label="Remove">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-border/60 text-sm">
            <tr><td colSpan={3} className="px-4 py-2 text-right text-muted-foreground">Subtotal</td><td className="px-4 py-2 text-right tabular-nums">{subtotal.toFixed(2)}</td><td/></tr>
            <tr><td colSpan={3} className="px-4 py-2 text-right text-muted-foreground">Tax</td><td className="px-4 py-2 text-right tabular-nums">{Number(values.tax_amount).toFixed(2)}</td><td/></tr>
            <tr className="font-semibold"><td colSpan={3} className="px-4 py-3 text-right">Total ({values.currency})</td><td className="px-4 py-3 text-right tabular-nums">{total.toFixed(2)}</td><td/></tr>
          </tfoot>
        </table>
        {errors.items && <p className="px-5 py-2 text-xs text-destructive">{errors.items}</p>}
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-6">
        <Label>Notes</Label>
        <Textarea className="mt-1.5" rows={3} maxLength={2000} value={values.notes} onChange={(e) => setValues((s) => ({ ...s, notes: e.target.value }))} />
      </section>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => navigate({ to: "/invoices" })}>Cancel</Button>
        <Button onClick={submit} disabled={saveMut.isPending}>
          {saveMut.isPending ? "Saving…" : isNew ? "Create invoice" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
