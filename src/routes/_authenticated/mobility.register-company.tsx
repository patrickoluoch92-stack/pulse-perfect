import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Building2, ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/states";
import { registerRentalCompany } from "@/lib/mobility-company.functions";
import {
  listMyMobilityProviders,
  submitMobilityProviderForVerification,
  MOBILITY_CATEGORIES,
  MOBILITY_CATEGORY_LABELS,
  type MobilityCategory,
} from "@/lib/mobility.functions";
import { getWorkspaceContext } from "@/lib/workspace.functions";

export const Route = createFileRoute("/_authenticated/mobility/register-company")({
  component: RegisterCompanyPage,
});

function RegisterCompanyPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchCtx = useServerFn(getWorkspaceContext);
  const fetchProviders = useServerFn(listMyMobilityProviders);
  const register = useServerFn(registerRentalCompany);
  const submitForReview = useServerFn(submitMobilityProviderForVerification);

  const ctx = useQuery({ queryKey: ["workspace"], queryFn: () => fetchCtx() });
  const providers = useQuery({ queryKey: ["mobility-providers"], queryFn: () => fetchProviders() });
  const orgId = ctx.data?.currentOrg?.id;
  const existing = providers.data?.providers?.[0];

  const [name, setName] = useState(existing?.name ?? "");
  const [bio, setBio] = useState(existing?.bio ?? "");
  const [contactEmail, setContactEmail] = useState(existing?.contact_email ?? "");
  const [contactPhone, setContactPhone] = useState(existing?.contact_phone ?? "");
  const [website, setWebsite] = useState(existing?.website ?? "");
  const [town, setTown] = useState(existing?.town ?? "");
  const [address, setAddress] = useState(existing?.address ?? "");
  const [businessRegNumber, setBiz] = useState(existing?.business_reg_number ?? "");
  const [taxPin, setTaxPin] = useState(existing?.tax_pin ?? "");
  const [categories, setCategories] = useState<string[]>(existing?.service_categories ?? []);

  const save = useMutation({
    mutationFn: async () =>
      register({
        data: {
          orgId: orgId ?? undefined,
          name,
          bio: bio || undefined,
          contactEmail: contactEmail || undefined,
          contactPhone: contactPhone || undefined,
          website: website || undefined,
          town: town || undefined,
          address: address || undefined,
          businessRegNumber: businessRegNumber || undefined,
          taxPin: taxPin || undefined,
          serviceCategories: categories,
        },
      }),
    onSuccess: () => {
      toast.success("Company saved. Add fleet next.");
      qc.invalidateQueries({ queryKey: ["mobility-providers"] });
      qc.invalidateQueries({ queryKey: ["workspace"] });
      navigate({ to: "/mobility" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = useMutation({
    mutationFn: async (id: string) => submitForReview({ data: { id } }),
    onSuccess: () => {
      toast.success("Submitted for verification.");
      qc.invalidateQueries({ queryKey: ["mobility-providers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (ctx.isLoading || providers.isLoading)
    return (
      <DashboardShell>
        <LoadingState label="Loading…" />
      </DashboardShell>
    );

  return (
    <DashboardShell>
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <header className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Building2 className="h-6 w-6" /> Register your rental company
          </h1>
          <p className="text-sm text-muted-foreground">
            A verified company is required before you can list vehicles publicly.
          </p>
        </header>

        {existing && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Verification</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  Status:{" "}
                  <Badge variant="outline" className="capitalize">
                    {existing.verification_status ?? "unverified"}
                  </Badge>
                  {existing.verification_status === "approved" && (
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Vehicles become public only after your company is approved.
                </p>
              </div>
              {existing.verification_status !== "approved" &&
                existing.verification_status !== "pending" && (
                  <Button
                    variant="outline"
                    onClick={() => submit.mutate(existing.id)}
                    disabled={submit.isPending}
                  >
                    Submit for verification
                  </Button>
                )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Company profile</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Company name *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bio">About</Label>
              <Textarea id="bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Contact email</Label>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Contact phone</Label>
                <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Website</Label>
                <Input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://"
                />
              </div>
              <div className="grid gap-2">
                <Label>Town / City</Label>
                <Input value={town} onChange={(e) => setTown(e.target.value)} />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>Address</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Business reg. #</Label>
                <Input value={businessRegNumber} onChange={(e) => setBiz(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>KRA PIN</Label>
                <Input value={taxPin} onChange={(e) => setTaxPin(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Service categories</Label>
              <div className="flex flex-wrap gap-2">
                {(MOBILITY_CATEGORIES as readonly MobilityCategory[]).map((c) => {
                  const on = categories.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() =>
                        setCategories(on ? categories.filter((x) => x !== c) : [...categories, c])
                      }
                      className={`rounded-full border px-3 py-1 text-xs ${on ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary"}`}
                    >
                      {MOBILITY_CATEGORY_LABELS[c]}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Link to="/mobility" className="text-sm text-muted-foreground hover:underline">
            Cancel
          </Link>
          <Button onClick={() => save.mutate()} disabled={!name || save.isPending}>
            {existing ? "Save company" : "Create company"} <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </DashboardShell>
  );
}
