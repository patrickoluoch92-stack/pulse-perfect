import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminListAllPlans, adminUpsertPlan, adminSetPlanActive } from "@/lib/subscription.functions";
import { formatKES } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/plans")({
  head: () => ({ meta: [{ title: "Plan admin — HostPulse" }] }),
  component: PlansAdmin,
});

const emptyPlan = {
  code: "", name: "", tagline: "",
  price_monthly_kes: 0, price_yearly_kes: 0, trial_days: 0,
  property_limit: null as number | null, photo_limit_per_property: null as number | null,
  storage_mb: null as number | null, ai_calls_per_month: null as number | null,
  team_member_limit: null as number | null,
  has_api_access: false, has_priority_support: false, has_dynamic_pricing: false,
  has_channel_manager: false, has_promotional_boost: false, is_contact_sales: false,
  sort_order: 100, active: true,
};

function PlansAdmin() {
  const listFn = useServerFn(adminListAllPlans);
  const upsertFn = useServerFn(adminUpsertPlan);
  const setActiveFn = useServerFn(adminSetPlanActive);

  const q = useQuery({ queryKey: ["admin-plans"], queryFn: () => listFn() });
  const [editing, setEditing] = useState<any | null>(null);

  const upsertM = useMutation({
    mutationFn: (payload: any) => upsertFn({ data: payload }),
    onSuccess: () => { toast.success("Plan saved"); setEditing(null); q.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });
  const toggleM = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => setActiveFn({ data: v }),
    onSuccess: () => q.refetch(),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Subscription plans</h1>
          <p className="text-muted-foreground">Configure pricing tiers and their feature limits.</p>
        </div>
        <Button onClick={() => setEditing({ ...emptyPlan })}>New plan</Button>
      </header>

      <div className="grid gap-3">
        {(q.data?.rows ?? []).map((p: any) => (
          <Card key={p.id}>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{p.name}</span>
                  <code className="rounded bg-muted px-1.5 text-xs">{p.code}</code>
                  {!p.active && <span className="text-xs text-destructive">inactive</span>}
                </div>
                <div className="text-sm text-muted-foreground">
                  KES {p.price_monthly_kes.toLocaleString()}/mo · KES {p.price_yearly_kes.toLocaleString()}/yr
                  {" · "}Properties: {p.property_limit ?? "∞"} · Team: {p.team_member_limit ?? "∞"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={p.active} onCheckedChange={(v) => toggleM.mutate({ id: p.id, active: v })} />
                <Button variant="outline" size="sm" onClick={() => setEditing(p)}>Edit</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editing && (
        <Card>
          <CardHeader><CardTitle>{editing.id ? "Edit plan" : "New plan"}</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {[
              ["code","Code (unique)"],["name","Name"],["tagline","Tagline"],
              ["price_monthly_kes","Monthly (KES)"],["price_yearly_kes","Yearly (KES)"],["trial_days","Trial days"],
              ["property_limit","Property limit"],["photo_limit_per_property","Photos / property"],
              ["storage_mb","Storage MB"],["ai_calls_per_month","AI calls / month"],
              ["team_member_limit","Team member limit"],["sort_order","Sort order"],
            ].map(([k, label]) => (
              <div key={k} className="space-y-1">
                <Label>{label}</Label>
                <Input
                  value={editing[k] ?? ""}
                  type={typeof emptyPlan[k as keyof typeof emptyPlan] === "number" ? "number" : "text"}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const numeric = typeof emptyPlan[k as keyof typeof emptyPlan] === "number" || emptyPlan[k as keyof typeof emptyPlan] === null;
                    setEditing({ ...editing, [k]: numeric ? (raw === "" ? null : Number(raw)) : raw });
                  }}
                />
              </div>
            ))}
            {["has_api_access","has_priority_support","has_dynamic_pricing","has_channel_manager","has_promotional_boost","is_contact_sales","active"].map((k) => (
              <label key={k} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <span>{k}</span>
                <Switch checked={!!editing[k]} onCheckedChange={(v) => setEditing({ ...editing, [k]: v })} />
              </label>
            ))}
            <div className="md:col-span-2 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button
                onClick={() => {
                  const payload: any = { ...editing };
                  ["property_limit","photo_limit_per_property","storage_mb","ai_calls_per_month","team_member_limit"].forEach((k) => {
                    if (payload[k] === "") payload[k] = null;
                  });
                  upsertM.mutate(payload);
                }}
                disabled={upsertM.isPending}
              >Save</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
