import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { listUnits } from "@/lib/units.functions";
import {
  recommendPricing,
  forecastOccupancy,
  generateRevenueInsights,
} from "@/lib/revenue-intelligence.functions";
import { toast } from "sonner";
import { Sparkles, TrendingUp } from "lucide-react";
import { formatKES } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/revenue")({
  head: () => ({
    meta: [{ title: "Revenue Intelligence — HostPulse" }],
  }),
  component: RevenuePage,
});

function RevenuePage() {
  const units = useServerFn(listUnits);
  const price = useServerFn(recommendPricing);
  const forecast = useServerFn(forecastOccupancy);
  const insights = useServerFn(generateRevenueInsights);

  const [propertyId, setPropertyId] = useState<string>("");
  const [unitId, setUnitId] = useState<string>("");

  const properties = useQuery({
    queryKey: ["rev-props"],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const unitsQ = useQuery({
    queryKey: ["rev-units", propertyId],
    queryFn: () => units({ data: { propertyId } }),
    enabled: !!propertyId,
  });
  const forecastQ = useQuery({
    queryKey: ["rev-forecast", propertyId],
    queryFn: () => forecast({ data: { propertyId: propertyId || undefined, days: 60 } }),
  });

  const pricing = useMutation({
    mutationFn: (uid: string) => price({ data: { unitId: uid, horizonDays: 30 } }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Pricing failed"),
  });
  const ai = useMutation({
    mutationFn: () => insights({ data: { propertyId: propertyId || undefined } }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Insights failed"),
  });

  return (
    <DashboardShell>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="font-display text-2xl font-semibold">Revenue Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            AI-assisted dynamic pricing, occupancy forecasting, and revenue insights.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Select value={propertyId} onValueChange={(v) => { setPropertyId(v); setUnitId(""); }}>
            <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
            <SelectContent>
              {(properties.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={unitId} onValueChange={setUnitId} disabled={!propertyId}>
            <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
            <SelectContent>
              {(unitsQ.data ?? []).map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /> 60-day occupancy forecast</CardTitle>
          </CardHeader>
          <CardContent>
            {forecastQ.data ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <Stat label="Units tracked" value={forecastQ.data.summary.unitCount ?? 0} />
                  <Stat label="Avg occupancy" value={`${Math.round((forecastQ.data.summary.avgOccupancy ?? 0) * 100)}%`} />
                  <Stat label="Booked nights (60d)" value={forecastQ.data.summary.totalNights ?? 0} />
                </div>
                <div className="flex h-24 items-end gap-[2px]">
                  {forecastQ.data.days.map((d) => (
                    <div
                      key={d.date}
                      title={`${d.date}: ${Math.round(d.occupancy * 100)}%`}
                      className="flex-1 bg-primary/70"
                      style={{ height: `${Math.max(2, Math.round(d.occupancy * 100))}%` }}
                    />
                  ))}
                </div>
              </div>
            ) : <p className="text-sm text-muted-foreground">Loading forecast…</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Dynamic pricing (next 30 nights)</CardTitle>
            <Button size="sm" onClick={() => unitId && pricing.mutate(unitId)} disabled={!unitId || pricing.isPending}>
              {pricing.isPending ? "Calculating…" : "Recommend prices"}
            </Button>
          </CardHeader>
          <CardContent>
            {!unitId && <p className="text-sm text-muted-foreground">Pick a unit to compute recommendations.</p>}
            {pricing.data && (
              <div className="max-h-80 overflow-y-auto rounded border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-right">Base</th>
                      <th className="p-2 text-right">Suggested</th>
                      <th className="p-2 text-left">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricing.data.suggestions.map((s) => (
                      <tr key={s.date} className="border-t">
                        <td className="p-2">{s.date}</td>
                        <td className="p-2 text-right">{s.baseRate.toLocaleString()}</td>
                        <td className="p-2 text-right font-medium">{s.suggestedRate.toLocaleString()}</td>
                        <td className="p-2 text-muted-foreground">{s.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> AI revenue insights</CardTitle>
            <Button size="sm" onClick={() => ai.mutate()} disabled={ai.isPending}>
              {ai.isPending ? "Analysing…" : "Generate insights"}
            </Button>
          </CardHeader>
          <CardContent>
            {ai.data ? (
              <div className="space-y-3">
                <p className="text-sm">{ai.data.insights.summary}</p>
                <div className="grid gap-2">
                  {ai.data.insights.recommendations.map((r, i) => (
                    <div key={i} className="rounded border p-3">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{r.title}</p>
                        <Badge variant={r.impact === "high" ? "default" : "secondary"}>{r.impact}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{r.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : <p className="text-sm text-muted-foreground">Click generate to analyse your last 90 days.</p>}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
