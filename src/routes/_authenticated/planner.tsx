import { createFileRoute, Link } from "@tanstack/react-router";
import { authPageMeta } from "@/lib/route-meta";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  Bot, Send, Sparkles, Trash2, MapPin, Wallet, Route as RouteIcon, Lightbulb, Loader2,
} from "lucide-react";
import {
  generatePlan, chatOnPlan, listPlannerSessions, getPlannerSession, deletePlannerSession,
  PLANNER_MODULES, type PlannerModule,
} from "@/lib/planner.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/planner")({
  head: () => ({
    meta: authPageMeta({
      title: "HostPulse Planner AI",
      description: "AI budget & itinerary planner — rentals, travel, events, honeymoons, student stays and more, tuned to Kenyan prices.",
    }),
  }),
  component: PlannerPage,
});

const MODULES: { id: PlannerModule; label: string; hint: string }[] = [
  { id: "rental",   label: "🏠 Rental Budget",     hint: "I earn KES 90,000 — where should I rent in Nairobi?" },
  { id: "travel",   label: "✈️ Travel",             hint: "Plan a 4-day Diani trip for 2, budget KES 60,000." },
  { id: "stay",     label: "🏨 Stay",               hint: "Business stay in Kisumu for 5 nights under KES 40,000." },
  { id: "event",    label: "🎉 Event",              hint: "Wedding for 120 guests in Naivasha, budget KES 800,000." },
  { id: "business", label: "💼 Business Travel",    hint: "Conference in Mombasa, 3 nights, need hotel near KICC." },
  { id: "family",   label: "👨‍👩‍👧 Family Vacation",   hint: "Family of 5 to Nakuru for a weekend, kids 6 & 9." },
  { id: "honeymoon",label: "💑 Honeymoon",          hint: "Romantic 5-night honeymoon, KES 180,000, prefer beach." },
  { id: "student",  label: "🎓 Student",            hint: "Accommodation near Kenyatta University under KES 12,000." },
  { id: "weekend",  label: "🧭 Weekend Getaway",    hint: "Weekend road trip from Nairobi, KES 25,000." },
  { id: "general",  label: "💬 General",            hint: "Ask anything about planning your stay or trip." },
];

const KES = (v: number) => `KES ${Math.round(v || 0).toLocaleString()}`;

function PlannerPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPlannerSessions);
  const getFn = useServerFn(getPlannerSession);
  const generateFn = useServerFn(generatePlan);
  const chatFn = useServerFn(chatOnPlan);
  const delFn = useServerFn(deletePlannerSession);

  const [activeId, setActiveId] = useState<string | undefined>();
  const [module, setModule] = useState<PlannerModule>("travel");
  const [county, setCounty] = useState("");
  const [prompt, setPrompt] = useState("");
  const [chatInput, setChatInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const sessions = useQuery({ queryKey: ["planner", "list"], queryFn: () => listFn() });
  const session = useQuery({
    enabled: !!activeId,
    queryKey: ["planner", "session", activeId],
    queryFn: () => getFn({ data: { id: activeId! } }),
  });

  const gen = useMutation({
    mutationFn: (vars: { prompt: string; module: PlannerModule; county?: string; sessionId?: string }) =>
      generateFn({ data: vars }),
    onSuccess: (res) => {
      setActiveId(res.sessionId);
      setPrompt("");
      qc.invalidateQueries({ queryKey: ["planner"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to generate plan"),
  });

  const chat = useMutation({
    mutationFn: (msg: string) => chatFn({ data: { sessionId: activeId!, message: msg } }),
    onSuccess: () => {
      setChatInput("");
      qc.invalidateQueries({ queryKey: ["planner", "session", activeId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Chat failed"),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      if (activeId) setActiveId(undefined);
      qc.invalidateQueries({ queryKey: ["planner"] });
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [session.data?.session?.messages]);

  const plan = (session.data?.session?.plan ?? {}) as any;
  const messages = ((session.data?.session?.messages ?? []) as any[]) as Array<{ role: string; content: string }>;
  const selectedHint = MODULES.find((m) => m.id === module)?.hint ?? "";

  return (
    <div className="mx-auto grid max-w-7xl gap-4 p-4 md:grid-cols-[16rem_1fr] md:p-8">
      {/* Sessions */}
      <aside className="space-y-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-primary" /> My plans
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 px-2 pb-2">
            <Button size="sm" variant="outline" className="w-full" onClick={() => setActiveId(undefined)}>
              + New plan
            </Button>
            {(sessions.data?.sessions ?? []).map((s: any) => (
              <div key={s.id} className={`group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm ${activeId === s.id ? "bg-muted" : "hover:bg-muted/50"}`}>
                <button className="min-w-0 flex-1 text-left" onClick={() => setActiveId(s.id)}>
                  <div className="truncate font-medium">{s.title ?? "Untitled"}</div>
                  <div className="truncate text-xs text-muted-foreground">{s.module}</div>
                </button>
                <button
                  className="opacity-0 group-hover:opacity-100"
                  onClick={() => del.mutate(s.id)}
                  aria-label="Delete plan"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
            {!sessions.data?.sessions?.length && (
              <p className="px-2 py-3 text-xs text-muted-foreground">No plans yet — start one on the right.</p>
            )}
          </CardContent>
        </Card>
      </aside>

      {/* Main */}
      <section className="space-y-4">
        <header>
          <p className="text-sm text-muted-foreground">HostPulse Planner AI</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Turn your budget into a complete plan
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tell me your budget and I'll allocate it, suggest properties, and build your itinerary — tuned to Kenyan prices.
          </p>
        </header>

        {/* Composer */}
        <Card>
          <CardContent className="space-y-3 pt-4">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_10rem]">
              <Select value={module} onValueChange={(v) => setModule(v as PlannerModule)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODULES.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="County (optional)"
                value={county}
                onChange={(e) => setCounty(e.target.value)}
              />
              <Button
                disabled={gen.isPending || !prompt.trim()}
                onClick={() =>
                  gen.mutate({
                    prompt: prompt.trim(),
                    module,
                    county: county.trim() || undefined,
                    sessionId: activeId,
                  })
                }
              >
                {gen.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
                Generate plan
              </Button>
            </div>
            <Textarea
              rows={3}
              placeholder={selectedHint}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Plan */}
        {session.data?.session && (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" /> {plan.title ?? "Your plan"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {plan.summary && <p className="text-sm">{plan.summary}</p>}

                {/* Scores */}
                {plan.scores && (
                  <div className="grid grid-cols-3 gap-2">
                    {(["budgetFit", "valueScore", "affordability"] as const).map((k) => (
                      <div key={k} className="rounded-md border p-2">
                        <div className="text-xs capitalize text-muted-foreground">{k.replace(/([A-Z])/g, " $1")}</div>
                        <div className="text-lg font-semibold">{Math.round(plan.scores?.[k] ?? 0)}</div>
                        <Progress value={plan.scores?.[k] ?? 0} className="h-1.5" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Allocations */}
                {Array.isArray(plan.allocations) && plan.allocations.length > 0 && (
                  <div>
                    <h3 className="mb-2 flex items-center gap-2 font-semibold"><Wallet className="h-4 w-4" /> Budget breakdown</h3>
                    <div className="space-y-1">
                      {plan.allocations.map((a: any, i: number) => (
                        <div key={i} className="flex items-center justify-between rounded-md border p-2 text-sm">
                          <div>
                            <div className="font-medium">{a.category}</div>
                            {a.note && <div className="text-xs text-muted-foreground">{a.note}</div>}
                          </div>
                          <div className="font-semibold">{KES(Number(a.amount) || 0)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Itinerary */}
                {Array.isArray(plan.itinerary) && plan.itinerary.length > 0 && (
                  <div>
                    <h3 className="mb-2 flex items-center gap-2 font-semibold"><RouteIcon className="h-4 w-4" /> Itinerary</h3>
                    <div className="space-y-2">
                      {plan.itinerary.map((d: any, i: number) => (
                        <div key={i} className="rounded-md border p-2">
                          <div className="mb-1 text-sm font-semibold">{d.day}</div>
                          <ul className="ml-4 list-disc space-y-0.5 text-sm text-muted-foreground">
                            {(d.items ?? []).map((it: string, j: number) => <li key={j}>{it}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Savings & alternatives */}
                {(plan.savingsTips?.length || plan.alternatives?.length) && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {plan.savingsTips?.length > 0 && (
                      <div>
                        <h4 className="mb-1 flex items-center gap-2 text-sm font-semibold"><Lightbulb className="h-4 w-4" /> Savings tips</h4>
                        <ul className="ml-4 list-disc space-y-0.5 text-xs text-muted-foreground">
                          {plan.savingsTips.map((t: string, i: number) => <li key={i}>{t}</li>)}
                        </ul>
                      </div>
                    )}
                    {plan.alternatives?.length > 0 && (
                      <div>
                        <h4 className="mb-1 text-sm font-semibold">Alternatives</h4>
                        <ul className="ml-4 list-disc space-y-0.5 text-xs text-muted-foreground">
                          {plan.alternatives.map((t: string, i: number) => <li key={i}>{t}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {plan.packingList?.length > 0 && (
                  <div>
                    <h4 className="mb-1 text-sm font-semibold">Packing list</h4>
                    <div className="flex flex-wrap gap-1">
                      {plan.packingList.map((t: string, i: number) => <Badge key={i} variant="secondary">{t}</Badge>)}
                    </div>
                  </div>
                )}

                {plan.warnings?.length > 0 && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs">
                    {plan.warnings.map((w: string, i: number) => <div key={i}>⚠️ {w}</div>)}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Chat + recommendations */}
            <div className="space-y-3">
              {Array.isArray(plan.recommendedProperties) && plan.recommendedProperties.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4" /> Suggested properties</CardTitle></CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    {plan.recommendedProperties.slice(0, 8).map((slug: string) => (
                      <Link
                        key={slug}
                        to="/marketplace/p/$slug"
                        params={{ slug }}
                        className="block truncate rounded-md border p-2 hover:bg-muted"
                      >
                        {slug}
                      </Link>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Refine with AI</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <div ref={scrollRef} className="max-h-64 space-y-2 overflow-auto rounded-md border bg-muted/30 p-2">
                    {messages.slice(-10).map((m, i) => (
                      <div key={i} className={`text-sm ${m.role === "user" ? "text-foreground" : "text-muted-foreground"}`}>
                        <span className="font-medium">{m.role === "user" ? "You" : "AI"}: </span>{m.content}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ask a follow-up…"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && chatInput.trim() && chat.mutate(chatInput.trim())}
                    />
                    <Button
                      size="icon"
                      disabled={chat.isPending || !chatInput.trim()}
                      onClick={() => chat.mutate(chatInput.trim())}
                      aria-label="Send"
                    >
                      {chat.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
