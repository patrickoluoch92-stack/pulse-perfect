import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, CheckCircle2, Loader2, MapPin, Sparkles, Upload, X, Wand2, Plus, Trash2, Building2,
} from "lucide-react";

import { authPageMeta } from "@/lib/route-meta";
import { supabase } from "@/integrations/supabase/client";
import { getWorkspaceContext } from "@/lib/workspace.functions";
import { listCounties } from "@/lib/marketplace.functions";
import {
  getCurrentDraft, saveDraft, publishDraft, type DraftPayload,
} from "@/lib/onboarding.functions";
import {
  aiPrefillProperty, aiGenerateDescription, aiAssistantSuggest,
} from "@/lib/onboarding-ai.functions";
import { placesAutocomplete, placeDetails } from "@/lib/places.functions";
import { PROPERTY_CATEGORIES, COMMON_AMENITIES, MARKETPLACE_BUCKET } from "@/lib/marketplace-constants";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { LoadingState, EmptyState } from "@/components/ui/states";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: authPageMeta({
      title: "List your property — HostPulse onboarding",
      description: "Add your hotel, lodge, camp, apartment or villa to HostPulse in under 5 minutes.",
    }),
  }),
  errorComponent: ({ error, reset }) => (
    <DashboardShell>
      <div className="p-12 text-center">
        <p className="text-destructive">{error.message}</p>
        <button onClick={reset} className="mt-3 text-primary underline">Retry</button>
      </div>
    </DashboardShell>
  ),
  component: OnboardingWizard,
});

const STEPS = [
  "Business", "Location", "AI Prefill", "Details", "Description",
  "Media", "Rooms", "Availability", "Payments", "Review",
] as const;

const emptyPayload: DraftPayload = {
  amenities: [], rooms: [], landmarks: [], galleryPaths: [], seasonalRates: [], blockedDates: [],
  currency: "KES",
  payments: { mpesa: true, cards: true, bankTransfer: false, cashOnArrival: false },
};

function OnboardingWizard() {
  const router = useRouter();
  const wsFn = useServerFn(getWorkspaceContext);
  const ws = useQuery({ queryKey: ["workspace-context"], queryFn: () => wsFn() });
  const orgId = ws.data?.currentOrg?.id;

  const getDraftFn = useServerFn(getCurrentDraft);
  const saveDraftFn = useServerFn(saveDraft);
  const publishFn = useServerFn(publishDraft);

  const [step, setStep] = useState(1);
  const [draftId, setDraftId] = useState<string | undefined>();
  const [payload, setPayload] = useState<DraftPayload>(emptyPayload);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Load existing draft
  useEffect(() => {
    if (!orgId || loaded) return;
    getDraftFn({ data: { orgId } }).then((row) => {
      if (row) {
        setDraftId(row.id);
        setStep(row.step ?? 1);
        setPayload({ ...emptyPayload, ...(row.payload as any) });
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [orgId, loaded, getDraftFn]);

  // Debounced autosave
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!orgId || !loaded) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        setSaving(true);
        const res = await saveDraftFn({
          data: { orgId, draftId, step, payload },
        });
        if (!draftId) setDraftId(res.id);
      } catch (e: any) {
        // silent — surface only when user acts
      } finally {
        setSaving(false);
      }
    }, 1200);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, step, orgId, loaded]);

  const update = (patch: Partial<DraftPayload>) => setPayload((p) => ({ ...p, ...patch }));

  const canNext = useMemo(() => {
    if (step === 1) return !!(payload.name && payload.category);
    if (step === 2) return !!(payload.countyCode && payload.town);
    if (step === 4) return true;
    if (step === 5) return !!(payload.description && payload.description.length >= 20);
    return true;
  }, [step, payload]);

  async function publish() {
    if (!orgId || !draftId) return;
    setPublishing(true);
    try {
      const res = await publishFn({ data: { orgId, draftId } });
      toast.success("Submitted for review!");
      router.navigate({ to: "/listings/$id", params: { id: res.propertyId! } });
    } catch (e: any) {
      toast.error(e.message ?? "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  if (!ws.data || !loaded) {
    return <DashboardShell><div className="p-8 text-muted-foreground">Loading…</div></DashboardShell>;
  }
  if (!orgId) {
    return <DashboardShell><div className="p-8">No workspace found.</div></DashboardShell>;
  }

  return (
    <DashboardShell>
      <div className="mx-auto max-w-6xl p-6">
        <header className="mb-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Property onboarding
          </div>
          <h1 className="mt-1 font-display text-3xl font-semibold">List your property in 5 minutes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your progress is saved automatically. {saving && <span className="ml-2 inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Saving…</span>}
          </p>
        </header>

        <StepBar step={step} onGo={setStep} />

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0 rounded-xl border bg-card p-6">
            {step === 1 && <Step1Business payload={payload} update={update} />}
            {step === 2 && <Step2Location payload={payload} update={update} />}
            {step === 3 && <Step3Prefill payload={payload} update={update} />}
            {step === 4 && <Step4Details payload={payload} update={update} />}
            {step === 5 && <Step5Description payload={payload} update={update} />}
            {step === 6 && <Step6Media payload={payload} update={update} orgId={orgId} />}
            {step === 7 && <Step7Rooms payload={payload} update={update} />}
            {step === 8 && <Step8Availability payload={payload} update={update} />}
            {step === 9 && <Step9Payments payload={payload} update={update} />}
            {step === 10 && <Step10Review payload={payload} />}

            <div className="mt-8 flex items-center justify-between border-t pt-4">
              <Button variant="outline" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              {step < 10 ? (
                <Button disabled={!canNext} onClick={() => setStep((s) => Math.min(10, s + 1))}>
                  Next <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={publish} disabled={publishing}>
                  {publishing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
                  {publishing ? "Publishing…" : "Submit for review"}
                </Button>
              )}
            </div>
          </div>

          <AiAssistantPanel payload={payload} />
        </div>
      </div>
    </DashboardShell>
  );
}

// ---------- Step bar --------------------------------------------------------

function StepBar({ step, onGo }: { step: number; onGo: (n: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        return (
          <button
            key={label}
            onClick={() => onGo(n)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
              active && "border-primary bg-primary/10 text-primary font-medium",
              done && !active && "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
              !active && !done && "text-muted-foreground hover:bg-muted",
            )}
          >
            <span className="grid h-4 w-4 place-items-center rounded-full bg-background text-[10px] font-semibold">
              {done ? "✓" : n}
            </span>
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Steps -----------------------------------------------------------

function Step1Business({ payload, update }: StepProps) {
  return (
    <div className="space-y-4">
      <H title="Business information" desc="Tell us about your property and how guests can reach you." />
      <div className="grid gap-4 md:grid-cols-2">
        <F label="Property name *">
          <Input value={payload.name ?? ""} onChange={(e) => update({ name: e.target.value })} maxLength={120} placeholder="e.g. Baobab Beach Resort" />
        </F>
        <F label="Property type *">
          <Select value={payload.category ?? ""} onValueChange={(v) => update({ category: v as any })}>
            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              {PROPERTY_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </F>
        <F label="Owner name"><Input value={payload.ownerName ?? ""} onChange={(e) => update({ ownerName: e.target.value })} maxLength={120} /></F>
        <F label="Company name"><Input value={payload.companyName ?? ""} onChange={(e) => update({ companyName: e.target.value })} maxLength={120} /></F>
        <F label="Email"><Input type="email" value={payload.email ?? ""} onChange={(e) => update({ email: e.target.value })} maxLength={255} /></F>
        <F label="Phone"><Input value={payload.phone ?? ""} onChange={(e) => update({ phone: e.target.value })} maxLength={40} placeholder="+254…" /></F>
        <F label="WhatsApp"><Input value={payload.whatsapp ?? ""} onChange={(e) => update({ whatsapp: e.target.value })} maxLength={40} /></F>
        <F label="Website"><Input value={payload.website ?? ""} onChange={(e) => update({ website: e.target.value })} maxLength={255} placeholder="https://" /></F>
      </div>
    </div>
  );
}

function Step2Location({ payload, update }: StepProps) {
  const countiesFn = useServerFn(listCounties);
  const counties = useQuery({ queryKey: ["mkt-counties"], queryFn: () => countiesFn() });
  const autoFn = useServerFn(placesAutocomplete);
  const detailsFn = useServerFn(placeDetails);
  const [q, setQ] = useState("");
  const [sugs, setSugs] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const sessionToken = useRef(crypto.randomUUID()).current;

  useEffect(() => {
    if (!q || q.length < 3) { setSugs([]); return; }
    const t = setTimeout(() => {
      autoFn({ data: { input: q, sessionToken } }).then((r: any) => setSugs(r.suggestions ?? [])).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [q, autoFn, sessionToken]);

  async function pick(placeId: string) {
    setBusy(true);
    try {
      const d = await detailsFn({ data: { placeId, sessionToken } });
      update({
        town: d.town || payload.town,
        latitude: d.latitude ?? undefined,
        longitude: d.longitude ?? undefined,
        googleMapsUrl: d.googleMapsUri ?? undefined,
      });
      // Try to match county by name
      if (d.county && counties.data) {
        const match = counties.data.find((c: any) => c.name.toLowerCase() === d.county.toLowerCase());
        if (match) update({ countyCode: match.code });
      }
      toast.success("Location filled from Google Maps");
      setQ(""); setSugs([]);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <H title="Location" desc="Pin your property so guests can find you." />
      <F label="Search on Google Maps">
        <div className="relative">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search address, hotel or landmark…" />
          {sugs.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-lg">
              {sugs.map((s) => (
                <button key={s.placeId} type="button" disabled={busy}
                  onClick={() => pick(s.placeId)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{s.mainText}</div>
                    <div className="text-xs text-muted-foreground">{s.secondaryText}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </F>

      <div className="grid gap-4 md:grid-cols-2">
        <F label="County *">
          <Select value={payload.countyCode ?? ""} onValueChange={(v) => update({ countyCode: v })}>
            <SelectTrigger><SelectValue placeholder="Select county" /></SelectTrigger>
            <SelectContent>
              {(counties.data ?? []).map((c: any) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </F>
        <F label="Town / area *"><Input value={payload.town ?? ""} onChange={(e) => update({ town: e.target.value })} maxLength={80} /></F>
        <F label="Ward"><Input value={payload.ward ?? ""} onChange={(e) => update({ ward: e.target.value })} maxLength={80} /></F>
        <F label="Postal address"><Input value={payload.postalAddress ?? ""} onChange={(e) => update({ postalAddress: e.target.value })} maxLength={200} /></F>
        <F label="Latitude">
          <Input type="number" step="0.000001" value={payload.latitude ?? ""} onChange={(e) => update({ latitude: e.target.value === "" ? null : Number(e.target.value) })} />
        </F>
        <F label="Longitude">
          <Input type="number" step="0.000001" value={payload.longitude ?? ""} onChange={(e) => update({ longitude: e.target.value === "" ? null : Number(e.target.value) })} />
        </F>
      </div>

      <F label="Nearby landmarks (comma-separated)">
        <Input value={(payload.landmarks ?? []).join(", ")} onChange={(e) => update({ landmarks: e.target.value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10) })} />
      </F>
    </div>
  );
}

function Step3Prefill({ payload, update }: StepProps) {
  const prefillFn = useServerFn(aiPrefillProperty);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function run() {
    if (!payload.name || payload.name.length < 2) { toast.error("Add a property name in step 1 first"); return; }
    setBusy(true);
    try {
      const res = await prefillFn({ data: { name: payload.name, location: [payload.town, payload.ward].filter(Boolean).join(", ") } });
      setResult(res);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  function apply() {
    if (!result) return;
    const merged = new Set<string>([...(payload.amenities ?? []), ...(result.amenitiesGuess ?? [])]);
    update({
      category: (payload.category as any) ?? result.category ?? undefined,
      landmarks: payload.landmarks?.length ? payload.landmarks : (result.landmarks ?? []),
      amenities: Array.from(merged).slice(0, 40),
    });
    toast.success("Applied AI suggestions");
  }

  return (
    <div className="space-y-4">
      <H title="AI smart prefill" desc="We'll suggest public factual info for your property. Nothing is copied from other sites — you review and edit everything before publishing." />
      <Button onClick={run} disabled={busy}>
        {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Wand2 className="mr-1 h-4 w-4" />}
        {busy ? "Thinking…" : "Suggest info"}
      </Button>

      {result && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
          <Row k="Suggested category" v={result.category ?? "—"} />
          <Row k="County guess" v={result.countyGuess ?? "—"} />
          <Row k="Town guess" v={result.townGuess ?? "—"} />
          <Row k="Landmarks" v={(result.landmarks ?? []).join(", ") || "—"} />
          <Row k="Amenities" v={(result.amenitiesGuess ?? []).join(", ") || "—"} />
          {result.shortSummary && <Row k="Summary" v={result.shortSummary} />}
          <Button size="sm" onClick={apply}>Apply to my listing</Button>
        </div>
      )}
    </div>
  );
}

function Step4Details({ payload, update }: StepProps) {
  const toggle = (k: string) => (v: boolean) => {
    const set = new Set(payload.amenities ?? []);
    if (v) set.add(k); else set.delete(k);
    update({ amenities: Array.from(set) });
  };
  return (
    <div className="space-y-4">
      <H title="Property details" desc="Rooms, amenities and policies." />
      <div className="grid gap-4 md:grid-cols-3">
        <F label="Number of rooms">
          <Input type="number" min={0} value={payload.numRooms ?? ""} onChange={(e) => update({ numRooms: e.target.value === "" ? undefined : Number(e.target.value) })} />
        </F>
        <F label="Pet policy"><Input value={payload.petPolicy ?? ""} onChange={(e) => update({ petPolicy: e.target.value })} maxLength={200} placeholder="Pets allowed?" /></F>
        <F label="Smoking policy"><Input value={payload.smokingPolicy ?? ""} onChange={(e) => update({ smokingPolicy: e.target.value })} maxLength={200} /></F>
      </div>
      <div>
        <Label>Amenities</Label>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
          {COMMON_AMENITIES.map((a) => (
            <label key={a} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={(payload.amenities ?? []).includes(a)}
                onCheckedChange={(v) => toggle(a)(Boolean(v))}
              />
              {a}
            </label>
          ))}
        </div>
      </div>
      <F label="Accessibility features (comma-separated)">
        <Input value={(payload.accessibility ?? []).join(", ")}
          onChange={(e) => update({ accessibility: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          placeholder="Wheelchair ramp, ground-floor rooms…" />
      </F>
    </div>
  );
}

function Step5Description({ payload, update }: StepProps) {
  const genFn = useServerFn(aiGenerateDescription);
  const [busy, setBusy] = useState(false);

  async function generate() {
    if (!payload.name || !payload.category || !payload.town) {
      toast.error("Fill business & location first");
      return;
    }
    setBusy(true);
    try {
      const res = await genFn({
        data: {
          name: payload.name, category: payload.category as any,
          town: payload.town, county: payload.countyCode,
          amenities: payload.amenities ?? [],
          numRooms: payload.numRooms,
          landmarks: payload.landmarks,
        },
      });
      update({ description: res.description });
      toast.success("Description generated");
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  const len = (payload.description ?? "").length;
  return (
    <div className="space-y-4">
      <H title="Description" desc="Generate an original SEO-friendly description, then edit as you like." />
      <Button onClick={generate} disabled={busy}>
        {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Wand2 className="mr-1 h-4 w-4" />}
        {busy ? "Writing…" : "Generate with AI"}
      </Button>
      <Textarea rows={10} value={payload.description ?? ""} onChange={(e) => update({ description: e.target.value })} maxLength={4000} />
      <p className="text-xs text-muted-foreground">{len} / 4000 — minimum 20 characters</p>
    </div>
  );
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function Step6Media({ payload, update, orgId }: StepProps & { orgId: string }) {
  const [busy, setBusy] = useState(false);

  async function upload(files: FileList | null, asMain: boolean) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const { compressImage } = await import("@/lib/image-compress");
      const existingHashes = new Set<string>();
      const added: string[] = [];
      for (const file of Array.from(files)) {
        const compressed = await compressImage(file, { maxDim: 1920, quality: 0.82 });
        const buf = await compressed.arrayBuffer();
        const hash = await sha256Hex(buf);
        if (existingHashes.has(hash)) continue;
        existingHashes.add(hash);
        const ext = compressed.type === "image/jpeg" ? "jpg" : (compressed.name.split(".").pop() ?? "jpg").toLowerCase();
        const path = `${orgId}/drafts/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from(MARKETPLACE_BUCKET).upload(path, compressed, { contentType: compressed.type });
        if (error) throw error;
        if (asMain) { update({ mainImagePath: path }); break; }
        added.push(path);
      }
      if (added.length) update({ galleryPaths: [...(payload.galleryPaths ?? []), ...added].slice(0, 40) });
      toast.success("Uploaded");
    } catch (e: any) { toast.error(e.message ?? "Upload failed"); }
    finally { setBusy(false); }
  }

  async function urlFor(path: string) {
    const { data } = await supabase.storage.from(MARKETPLACE_BUCKET).createSignedUrl(path, 3600);
    return data?.signedUrl ?? "";
  }

  return (
    <div className="space-y-4">
      <H title="Photos" desc="Upload a cover image and gallery. We compress images automatically." />

      <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
        <div>
          <Label>Cover image</Label>
          <MediaPreview path={payload.mainImagePath ?? null} urlFor={urlFor} className="aspect-video" />
          <label className="mt-2 inline-flex">
            <Button asChild variant="outline" size="sm" disabled={busy}>
              <span>
                <Upload className="mr-2 h-4 w-4" /> {busy ? "Uploading…" : "Upload cover"}
                <input type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files, true)} />
              </span>
            </Button>
          </label>
        </div>
        <div>
          <Label>Gallery ({(payload.galleryPaths ?? []).length}/40)</Label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(payload.galleryPaths ?? []).map((path, i) => (
              <div key={path} className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
                <MediaPreview path={path} urlFor={urlFor} className="h-full w-full" />
                <button type="button"
                  onClick={() => update({ galleryPaths: (payload.galleryPaths ?? []).filter((_, j) => j !== i) })}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <label className="grid aspect-square cursor-pointer place-items-center rounded-lg border border-dashed text-muted-foreground hover:border-primary hover:text-primary">
              <span className="text-xs"><Upload className="mx-auto mb-1 h-4 w-4" /> Add</span>
              <input type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files, false)} />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

function MediaPreview({ path, urlFor, className }: { path: string | null; urlFor: (p: string) => Promise<string>; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { if (path) urlFor(path).then(setUrl); else setUrl(null); }, [path, urlFor]);
  return (
    <div className={cn("overflow-hidden rounded-lg border bg-muted", className)}>
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xs text-muted-foreground">No image</div>}
    </div>
  );
}

function Step7Rooms({ payload, update }: StepProps) {
  const rooms = payload.rooms ?? [];
  function add() {
    update({ rooms: [...rooms, { name: "", capacity: 2, pricePerNight: 0 }] });
  }
  function set(i: number, patch: Partial<(typeof rooms)[number]>) {
    const next = rooms.map((r, j) => (j === i ? { ...r, ...patch } : r));
    update({ rooms: next });
  }
  function rm(i: number) { update({ rooms: rooms.filter((_, j) => j !== i) }); }

  return (
    <div className="space-y-4">
      <H title="Rooms & pricing" desc="Add each room category with capacity, pricing and description." />
      {rooms.map((r, i) => (
        <div key={i} className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium"><Building2 className="h-4 w-4" /> Room {i + 1}</div>
            <Button variant="ghost" size="sm" onClick={() => rm(i)}><Trash2 className="h-4 w-4" /></Button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <F label="Name"><Input value={r.name} onChange={(e) => set(i, { name: e.target.value })} maxLength={120} placeholder="Deluxe Double" /></F>
            <F label="Capacity"><Input type="number" min={1} max={64} value={r.capacity ?? ""} onChange={(e) => set(i, { capacity: Number(e.target.value) })} /></F>
            <F label="Bed type"><Input value={r.bedType ?? ""} onChange={(e) => set(i, { bedType: e.target.value })} placeholder="King, Twin…" /></F>
            <F label="Price/night (KES)"><Input type="number" min={0} value={r.pricePerNight ?? ""} onChange={(e) => set(i, { pricePerNight: Number(e.target.value) })} /></F>
            <F label="Weekend price"><Input type="number" min={0} value={r.weekendPrice ?? ""} onChange={(e) => set(i, { weekendPrice: Number(e.target.value) })} /></F>
            <F label="Holiday price"><Input type="number" min={0} value={r.holidayPrice ?? ""} onChange={(e) => set(i, { holidayPrice: Number(e.target.value) })} /></F>
          </div>
          <F label="Description"><Textarea rows={2} value={r.description ?? ""} onChange={(e) => set(i, { description: e.target.value })} maxLength={1000} /></F>
        </div>
      ))}
      <Button variant="outline" onClick={add}><Plus className="mr-1 h-4 w-4" /> Add room category</Button>
    </div>
  );
}

function Step8Availability({ payload, update }: StepProps) {
  const rates = payload.seasonalRates ?? [];
  const blocks = payload.blockedDates ?? [];
  return (
    <div className="space-y-6">
      <H title="Availability & seasonal pricing" desc="Optional — block dates and configure high/low season pricing." />

      <div className="space-y-3">
        <Label>Seasonal rates</Label>
        {rates.map((r, i) => (
          <div key={i} className="grid gap-2 md:grid-cols-[1fr_140px_140px_140px_40px]">
            <Input value={r.label} placeholder="Peak season" onChange={(e) => {
              const next = rates.map((x, j) => j === i ? { ...x, label: e.target.value } : x);
              update({ seasonalRates: next });
            }} />
            <Input type="date" value={r.startDate} onChange={(e) => update({ seasonalRates: rates.map((x, j) => j === i ? { ...x, startDate: e.target.value } : x) })} />
            <Input type="date" value={r.endDate} onChange={(e) => update({ seasonalRates: rates.map((x, j) => j === i ? { ...x, endDate: e.target.value } : x) })} />
            <Input type="number" value={r.price} placeholder="Price" onChange={(e) => update({ seasonalRates: rates.map((x, j) => j === i ? { ...x, price: Number(e.target.value) } : x) })} />
            <Button variant="ghost" size="icon" onClick={() => update({ seasonalRates: rates.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => update({ seasonalRates: [...rates, { label: "", startDate: "", endDate: "", price: 0 }] })}>
          <Plus className="mr-1 h-4 w-4" /> Add season
        </Button>
      </div>

      <div className="space-y-3">
        <Label>Blocked dates</Label>
        {blocks.map((b, i) => (
          <div key={i} className="grid gap-2 md:grid-cols-[140px_140px_1fr_40px]">
            <Input type="date" value={b.startDate} onChange={(e) => update({ blockedDates: blocks.map((x, j) => j === i ? { ...x, startDate: e.target.value } : x) })} />
            <Input type="date" value={b.endDate} onChange={(e) => update({ blockedDates: blocks.map((x, j) => j === i ? { ...x, endDate: e.target.value } : x) })} />
            <Input value={b.reason ?? ""} placeholder="Reason" onChange={(e) => update({ blockedDates: blocks.map((x, j) => j === i ? { ...x, reason: e.target.value } : x) })} />
            <Button variant="ghost" size="icon" onClick={() => update({ blockedDates: blocks.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => update({ blockedDates: [...blocks, { startDate: "", endDate: "" }] })}>
          <Plus className="mr-1 h-4 w-4" /> Block dates
        </Button>
      </div>
    </div>
  );
}

function Step9Payments({ payload, update }: StepProps) {
  const p = payload.payments ?? {};
  const set = (k: keyof typeof p) => (v: boolean) => update({ payments: { ...p, [k]: v } });
  return (
    <div className="space-y-4">
      <H title="Payment methods" desc="Choose how guests can pay. M-Pesa and card payments are wired into HostPulse's payment infrastructure." />
      <div className="space-y-3">
        <PayRow label="M-Pesa" desc="Instant STK push checkout." checked={!!p.mpesa} onChange={set("mpesa")} />
        <PayRow label="Visa / Mastercard" desc="Card payments via Paddle." checked={!!p.cards} onChange={set("cards")} />
        <PayRow label="Bank transfer" desc="Manual EFT to your account." checked={!!p.bankTransfer} onChange={set("bankTransfer")} />
        <PayRow label="Cash on arrival" desc="Guest pays at check-in." checked={!!p.cashOnArrival} onChange={set("cashOnArrival")} />
      </div>
    </div>
  );
}

function PayRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-muted/40">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} className="mt-1" />
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-sm text-muted-foreground">{desc}</div>
      </div>
    </label>
  );
}

function Step10Review({ payload }: { payload: DraftPayload }) {
  return (
    <div className="space-y-4">
      <H title="Review & publish" desc="Everything below will be submitted for admin review." />
      <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
        <Row k="Name" v={payload.name || "—"} />
        <Row k="Type" v={payload.category || "—"} />
        <Row k="County / town" v={`${payload.countyCode ?? "—"} / ${payload.town ?? "—"}${payload.ward ? " / " + payload.ward : ""}`} />
        <Row k="Coordinates" v={payload.latitude && payload.longitude ? `${payload.latitude}, ${payload.longitude}` : "—"} />
        <Row k="Contact" v={[payload.email, payload.phone, payload.whatsapp].filter(Boolean).join(" · ") || "—"} />
        <Row k="Amenities" v={(payload.amenities ?? []).join(", ") || "—"} />
        <Row k="Rooms" v={String((payload.rooms ?? []).length)} />
        <Row k="Photos" v={`${payload.mainImagePath ? "cover set" : "no cover"}, ${(payload.galleryPaths ?? []).length} gallery`} />
        <Row k="Description" v={payload.description ? payload.description.slice(0, 200) + "…" : "—"} />
      </div>
      <p className="text-xs text-muted-foreground">Your listing goes live once an admin approves it. You can edit anytime from Marketplace → your listings.</p>
    </div>
  );
}

// ---------- AI assistant panel ---------------------------------------------

function AiAssistantPanel({ payload }: { payload: DraftPayload }) {
  const fn = useServerFn(aiAssistantSuggest);
  const [busy, setBusy] = useState(false);
  const [sugs, setSugs] = useState<any[]>([]);

  async function run() {
    setBusy(true);
    try {
      const r = await fn({ data: { draft: payload as any } });
      setSugs(r.suggestions ?? []);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  return (
    <aside className="h-fit rounded-xl border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">AI onboarding coach</h3>
      </div>
      <p className="text-xs text-muted-foreground">Get suggestions to strengthen your listing.</p>
      <Button size="sm" className="mt-3 w-full" onClick={run} disabled={busy}>
        {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Wand2 className="mr-1 h-4 w-4" />}
        {busy ? "Analyzing…" : "Review my listing"}
      </Button>
      <div className="mt-4 space-y-2">
        {sugs.map((s, i) => (
          <div key={i} className="rounded-md border bg-background p-2 text-xs">
            <div className="flex items-center gap-1">
              <Badge variant={s.severity === "high" ? "destructive" : "secondary"} className="text-[10px]">{s.severity}</Badge>
              {s.field && <span className="font-medium">{s.field}</span>}
            </div>
            <p className="mt-1 text-muted-foreground">{s.message}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}

// ---------- utility bits ---------------------------------------------------

type StepProps = { payload: DraftPayload; update: (patch: Partial<DraftPayload>) => void };

function H({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-40 shrink-0 text-muted-foreground">{k}</span>
      <span className="flex-1">{v}</span>
    </div>
  );
}
