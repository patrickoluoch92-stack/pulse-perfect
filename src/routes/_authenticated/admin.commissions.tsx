import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Coins, Percent, Plus, Trash2 } from "lucide-react";
import { authPageMeta } from "@/lib/route-meta";
import {
  adminListCommissionRules,
  adminUpsertCommissionRule,
  adminDeleteCommissionRule,
  adminListTaxRates,
  adminUpsertTaxRate,
} from "@/lib/finance.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatKES } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin/commissions")({
  head: () => ({
    meta: authPageMeta({
      title: "Commissions & Taxes",
      description: "Configure platform commission rules and tax rates.",
    }),
  }),
  component: CommissionsAdmin,
});

const SCOPES = ["global", "county", "category", "property", "org"] as const;

function CommissionsAdmin() {
  const qc = useQueryClient();
  const listRulesFn = useServerFn(adminListCommissionRules);
  const upsertFn = useServerFn(adminUpsertCommissionRule);
  const deleteFn = useServerFn(adminDeleteCommissionRule);
  const listTaxesFn = useServerFn(adminListTaxRates);
  const upsertTaxFn = useServerFn(adminUpsertTaxRate);

  const rules = useQuery({ queryKey: ["admin-rules"], queryFn: () => listRulesFn() });
  const taxes = useQuery({ queryKey: ["admin-taxes"], queryFn: () => listTaxesFn() });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Coins className="h-6 w-6" /> Commissions & Taxes
        </h1>
        <p className="text-sm text-muted-foreground">
          Rules apply in this order: property → org → category → county → global. Higher priority
          wins ties.
        </p>
      </header>

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">Commission rules</TabsTrigger>
          <TabsTrigger value="taxes">Tax rates</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <RuleDialog
              onSave={async (payload) => {
                await upsertFn({ data: payload });
                toast.success("Rule saved.");
                qc.invalidateQueries({ queryKey: ["admin-rules"] });
              }}
              trigger={
                <Button>
                  <Plus className="mr-1 h-4 w-4" /> New rule
                </Button>
              }
            />
          </div>

          <Card>
            <CardContent className="p-0">
              {rules.data?.rows?.length === 0 && <EmptyState title="No rules yet" />}
              <ul className="divide-y">
                {rules.data?.rows?.map((r: any) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{r.name}</span>
                        <Badge variant={r.active ? "default" : "secondary"}>
                          {r.active ? "active" : "inactive"}
                        </Badge>
                        <Badge variant="outline" className="capitalize">
                          {r.scope}
                          {r.scope_value ? `: ${r.scope_value}` : ""}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        <Percent className="inline h-3 w-3" /> {r.rate_percent}% +{" "}
                        {formatKES(Number(r.flat_amount ?? 0))} · priority {r.priority}
                      </p>
                      {r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}
                    </div>
                    <div className="flex gap-2">
                      <RuleDialog
                        initial={r}
                        onSave={async (payload) => {
                          await upsertFn({ data: { ...payload, id: r.id } });
                          toast.success("Rule updated.");
                          qc.invalidateQueries({ queryKey: ["admin-rules"] });
                        }}
                        trigger={
                          <Button variant="outline" size="sm">
                            Edit
                          </Button>
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          if (!confirm("Delete this rule?")) return;
                          await deleteFn({ data: { id: r.id } });
                          qc.invalidateQueries({ queryKey: ["admin-rules"] });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="taxes" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <TaxDialog
              onSave={async (payload) => {
                await upsertTaxFn({ data: payload });
                toast.success("Tax rate saved.");
                qc.invalidateQueries({ queryKey: ["admin-taxes"] });
              }}
              trigger={
                <Button>
                  <Plus className="mr-1 h-4 w-4" /> New tax
                </Button>
              }
            />
          </div>

          <Card>
            <CardContent className="p-0">
              <ul className="divide-y">
                {taxes.data?.rows?.map((t: any) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{t.name}</span>
                        <Badge variant={t.active ? "default" : "secondary"}>
                          {t.active ? "active" : "inactive"}
                        </Badge>
                        <Badge variant="outline">{t.code}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {t.rate_percent}% · applies to {(t.applies_to ?? []).join(", ")}
                      </p>
                    </div>
                    <TaxDialog
                      initial={t}
                      onSave={async (payload) => {
                        await upsertTaxFn({ data: { ...payload, id: t.id } });
                        toast.success("Updated.");
                        qc.invalidateQueries({ queryKey: ["admin-taxes"] });
                      }}
                      trigger={
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                      }
                    />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RuleDialog({
  initial,
  onSave,
  trigger,
}: {
  initial?: any;
  onSave: (data: any) => Promise<void>;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [scope, setScope] = useState<string>(initial?.scope ?? "global");
  const [scopeValue, setScopeValue] = useState(initial?.scope_value ?? "");
  const [rate, setRate] = useState(String(initial?.rate_percent ?? 10));
  const [flat, setFlat] = useState(String(initial?.flat_amount ?? 0));
  const [priority, setPriority] = useState(String(initial?.priority ?? 100));
  const [active, setActive] = useState<boolean>(initial?.active ?? true);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const save = useMutation({
    mutationFn: () =>
      onSave({
        name,
        scope: scope as any,
        scope_value: scope === "global" ? null : scopeValue,
        rate_percent: Number(rate),
        flat_amount: Number(flat),
        priority: Number(priority),
        active,
        notes: notes || undefined,
      }),
    onSuccess: () => setOpen(false),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit rule" : "New commission rule"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Scope</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCOPES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Scope value {scope === "global" ? "(none)" : ""}</Label>
              <Input
                value={scopeValue}
                onChange={(e) => setScopeValue(e.target.value)}
                disabled={scope === "global"}
                placeholder={
                  scope === "county"
                    ? "e.g. NAIROBI"
                    : scope === "category"
                      ? "e.g. villa"
                      : "UUID / code"
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Rate %</Label>
              <Input
                type="number"
                step="0.001"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </div>
            <div>
              <Label>Flat (KES)</Label>
              <Input type="number" value={flat} onChange={(e) => setFlat(e.target.value)} />
            </div>
            <div>
              <Label>Priority</Label>
              <Input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} />
            <Label>Active</Label>
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !name}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaxDialog({
  initial,
  onSave,
  trigger,
}: {
  initial?: any;
  onSave: (data: any) => Promise<void>;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [rate, setRate] = useState(String(initial?.rate_percent ?? 0));
  const [appliesTo, setAppliesTo] = useState<string[]>(initial?.applies_to ?? ["booking"]);
  const [active, setActive] = useState<boolean>(initial?.active ?? true);
  const save = useMutation({
    mutationFn: () =>
      onSave({
        code,
        name,
        rate_percent: Number(rate),
        applies_to: appliesTo as any,
        active,
      }),
    onSuccess: () => setOpen(false),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const toggle = (key: string) =>
    setAppliesTo((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit tax" : "New tax rate"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Code</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={!!initial}
                placeholder="vat"
              />
            </div>
            <div>
              <Label>Rate %</Label>
              <Input
                type="number"
                step="0.001"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Applies to</Label>
            {["booking", "invoice", "subscription"].map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={appliesTo.includes(k)} onChange={() => toggle(k)} />
                <span className="capitalize">{k}</span>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} />
            <Label>Active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !code || !name}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
