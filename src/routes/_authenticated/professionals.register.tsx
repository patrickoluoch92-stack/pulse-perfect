import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  getMyProfessional,
  upsertMyProfessional,
  listProfessionalCategories,
} from "@/lib/professionals.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowLeft, ArrowRight, Send } from "lucide-react";

export const Route = createFileRoute("/_authenticated/professionals/register")({
  component: RegisterProfessional,
});

const STEPS = ["Business", "Expertise", "Location", "Pricing", "Review"] as const;

function RegisterProfessional() {
  const navigate = useNavigate();
  const fetchMe = useServerFn(getMyProfessional);
  const fetchCats = useServerFn(listProfessionalCategories);
  const upsert = useServerFn(upsertMyProfessional);

  const me = useQuery({ queryKey: ["my-professional"], queryFn: () => fetchMe() });
  const cats = useQuery({ queryKey: ["pro-cats"], queryFn: () => fetchCats() });

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});

  // Hydrate from existing profile once
  if (me.data && !form._hydrated) {
    setForm({ ...me.data, _hydrated: true });
  }

  const set = (k: string, v: any) => setForm((s) => ({ ...s, [k]: v }));

  async function save(submit: boolean) {
    setSaving(true);
    try {
      const { _hydrated, ...clean } = form;
      const payload: any = {
        id: clean.id,
        business_name: clean.business_name,
        professional_name: clean.professional_name || null,
        category_id: clean.category_id || null,
        tagline: clean.tagline || null,
        description: clean.description || null,
        years_experience: clean.years_experience ? Number(clean.years_experience) : null,
        registration_status: clean.registration_status || null,
        registration_number: clean.registration_number || null,
        tax_pin: clean.tax_pin || null,
        county_code: clean.county_code || null,
        town: clean.town || null,
        area: clean.area || null,
        travels_to_clients: !!clean.travels_to_clients,
        nationwide: !!clean.nationwide,
        online_services: !!clean.online_services,
        max_travel_km: clean.max_travel_km ? Number(clean.max_travel_km) : null,
        phone: clean.phone || null,
        whatsapp: clean.whatsapp || null,
        email: clean.email || null,
        website: clean.website || null,
        pricing_model: clean.pricing_model || null,
        starting_price: clean.starting_price ? Number(clean.starting_price) : null,
        deposit_percentage: clean.deposit_percentage ? Number(clean.deposit_percentage) : null,
        cancellation_policy: clean.cancellation_policy || null,
        submit,
      };
      const saved: any = await upsert({ data: payload });
      toast.success(submit ? "Submitted for review" : "Draft saved");
      setForm({ ...saved, _hydrated: true });
      if (submit) navigate({ to: "/professionals/dashboard" });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const flatCats = (cats.data ?? []).flatMap((p: any) => [p, ...(p.children ?? [])]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Register as a Professional</h1>
        <p className="text-muted-foreground">List your services on HostPulse Professionals.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STEPS.map((s, i) => (
          <Badge key={s} variant={i === step ? "default" : i < step ? "secondary" : "outline"}>
            {i < step && <CheckCircle2 className="mr-1 h-3 w-3" />} {i + 1}. {s}
          </Badge>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
            <>
              <Field label="Business name *">
                <Input
                  value={form.business_name ?? ""}
                  onChange={(e) => set("business_name", e.target.value)}
                />
              </Field>
              <Field label="Your name (optional)">
                <Input
                  value={form.professional_name ?? ""}
                  onChange={(e) => set("professional_name", e.target.value)}
                />
              </Field>
              <Field label="Tagline">
                <Input
                  maxLength={160}
                  value={form.tagline ?? ""}
                  onChange={(e) => set("tagline", e.target.value)}
                />
              </Field>
              <Field label="Registration status">
                <Select
                  value={form.registration_status ?? ""}
                  onValueChange={(v) => set("registration_status", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose one" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual / freelancer</SelectItem>
                    <SelectItem value="registered_business">Registered business</SelectItem>
                    <SelectItem value="agency">Agency</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Registration number">
                  <Input
                    value={form.registration_number ?? ""}
                    onChange={(e) => set("registration_number", e.target.value)}
                  />
                </Field>
                <Field label="KRA PIN">
                  <Input
                    value={form.tax_pin ?? ""}
                    onChange={(e) => set("tax_pin", e.target.value)}
                  />
                </Field>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <Field label="Service category *">
                <Select value={form.category_id ?? ""} onValueChange={(v) => set("category_id", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {flatCats.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.parent_id ? "— " : ""}
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Description">
                <Textarea
                  rows={6}
                  value={form.description ?? ""}
                  onChange={(e) => set("description", e.target.value)}
                />
              </Field>
              <Field label="Years of experience">
                <Input
                  type="number"
                  min={0}
                  max={80}
                  value={form.years_experience ?? ""}
                  onChange={(e) => set("years_experience", e.target.value)}
                />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="County code">
                  <Input
                    value={form.county_code ?? ""}
                    onChange={(e) => set("county_code", e.target.value)}
                  />
                </Field>
                <Field label="Town">
                  <Input value={form.town ?? ""} onChange={(e) => set("town", e.target.value)} />
                </Field>
                <Field label="Area / estate">
                  <Input value={form.area ?? ""} onChange={(e) => set("area", e.target.value)} />
                </Field>
              </div>
              <div className="space-y-2 rounded border p-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={!!form.nationwide}
                    onCheckedChange={(v) => set("nationwide", !!v)}
                  />{" "}
                  Serves nationwide
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={!!form.travels_to_clients}
                    onCheckedChange={(v) => set("travels_to_clients", !!v)}
                  />{" "}
                  Travels to clients
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={!!form.online_services}
                    onCheckedChange={(v) => set("online_services", !!v)}
                  />{" "}
                  Offers online services
                </label>
                <Field label="Max travel distance (km)">
                  <Input
                    type="number"
                    min={0}
                    value={form.max_travel_km ?? ""}
                    onChange={(e) => set("max_travel_km", e.target.value)}
                  />
                </Field>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Phone">
                  <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
                </Field>
                <Field label="WhatsApp">
                  <Input
                    value={form.whatsapp ?? ""}
                    onChange={(e) => set("whatsapp", e.target.value)}
                  />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    value={form.email ?? ""}
                    onChange={(e) => set("email", e.target.value)}
                  />
                </Field>
                <Field label="Website">
                  <Input
                    type="url"
                    value={form.website ?? ""}
                    onChange={(e) => set("website", e.target.value)}
                  />
                </Field>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <Field label="Pricing model">
                <Select
                  value={form.pricing_model ?? ""}
                  onValueChange={(v) => set("pricing_model", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="half_day">Half day</SelectItem>
                    <SelectItem value="full_day">Full day</SelectItem>
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="starting_from">Starting from</SelectItem>
                    <SelectItem value="custom_quote">Custom quote</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Starting price (KES)">
                  <Input
                    type="number"
                    min={0}
                    value={form.starting_price ?? ""}
                    onChange={(e) => set("starting_price", e.target.value)}
                  />
                </Field>
                <Field label="Deposit percentage">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={form.deposit_percentage ?? ""}
                    onChange={(e) => set("deposit_percentage", e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Cancellation policy">
                <Textarea
                  rows={4}
                  value={form.cancellation_policy ?? ""}
                  onChange={(e) => set("cancellation_policy", e.target.value)}
                />
              </Field>
            </>
          )}

          {step === 4 && (
            <div className="space-y-3 text-sm">
              <Row k="Business" v={form.business_name} />
              <Row k="Category" v={flatCats.find((c: any) => c.id === form.category_id)?.name} />
              <Row k="Location" v={[form.town, form.county_code].filter(Boolean).join(", ")} />
              <Row
                k="Pricing"
                v={
                  form.pricing_model
                    ? `${form.pricing_model} · KES ${form.starting_price ?? "—"}`
                    : "—"
                }
              />
              <Row k="Contact" v={[form.phone, form.email].filter(Boolean).join(" · ")} />
              <p className="rounded bg-muted p-3 text-muted-foreground">
                Submitting sends your profile for review. You can still edit while it's pending.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => save(false)}
            disabled={saving || !form.business_name}
          >
            Save draft
          </Button>
          {step < STEPS.length - 1 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 0 && !form.business_name}
            >
              Next <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => save(true)} disabled={saving || !form.business_name}>
              <Send className="mr-1 h-4 w-4" /> Submit for review
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v?: string | null }) {
  return (
    <div className="flex justify-between border-b py-1.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v || "—"}</span>
    </div>
  );
}
