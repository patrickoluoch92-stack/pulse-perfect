import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Mail, Phone, Globe, Sparkles } from "lucide-react";
import { getDiscoveredPublic, startClaim, verifyClaim } from "@/lib/discovery.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/discover/$slug")({
  loader: async ({ params }) => {
    const { getDiscoveredPublic } = await import("@/lib/discovery.functions");
    const res = await getDiscoveredPublic({ data: { slug: params.slug } });
    if (!res.row) throw notFound();
    return res.row;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.name ?? "Property"} — HostPulse Discover` },
      {
        name: "description",
        content:
          loaderData?.ai_description?.slice(0, 155) ??
          "Discover this Kenyan accommodation on HostPulse.",
      },
      { property: "og:title", content: loaderData?.name ?? "Property" },
      {
        property: "og:description",
        content: loaderData?.ai_description?.slice(0, 200) ?? "Discovered accommodation.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl p-10 text-center">
      <h1 className="text-2xl font-semibold">Property not found</h1>
      <p className="mt-2 text-muted-foreground">
        It may have been merged or archived.
      </p>
      <Link to="/discover" className="mt-4 inline-block text-primary underline">
        Back to discover
      </Link>
    </div>
  ),
  errorComponent: ({ reset }) => (
    <div className="mx-auto max-w-2xl p-10 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <Button className="mt-4" onClick={reset}>Retry</Button>
    </div>
  ),
  component: DiscoverDetail,
});

function DiscoverDetail() {
  const row = Route.useLoaderData() as any;
  const [claiming, setClaiming] = useState(false);
  const [claimId, setClaimId] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | undefined>();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const start = useServerFn(startClaim);
  const verify = useServerFn(verifyClaim);
  const router = useRouter();

  async function ensureAuthAndStart() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      router.navigate({ to: "/auth" });
      return;
    }
    try {
      const r = await start({ data: { discoveredId: row.id, email, phone: phone || undefined } });
      setClaimId(r.claimId);
      setDevCode(r.devCodeHint);
      toast.success("Verification code sent (check your email).");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start claim");
    }
  }

  async function submitCode() {
    if (!claimId) return;
    try {
      await verify({ data: { claimId, code } });
      toast.success("Property claimed! Complete onboarding to publish.");
      router.navigate({ to: "/onboarding" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invalid code");
    }
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <Link to="/discover" className="text-sm text-muted-foreground hover:underline">
          ← All discoveries
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">{row.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {row.property_type && <Badge variant="secondary">{row.property_type}</Badge>}
          {row.county_code && <Badge variant="outline">County {row.county_code}</Badge>}
          {row.town && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {row.town}
              {row.ward ? `, ${row.ward}` : ""}
            </span>
          )}
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-[2fr_1fr]">
          <div>
            <div className="rounded-xl border bg-card p-5">
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" /> AI-generated overview
              </div>
              <p className="text-sm leading-relaxed">
                {row.ai_description ?? "No description yet — the AI hasn't visited this property in detail."}
              </p>
            </div>

            {row.address && (
              <div className="mt-4 rounded-xl border bg-card p-5">
                <h2 className="text-sm font-semibold">Address</h2>
                <p className="mt-1 text-sm text-muted-foreground">{row.address}</p>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-semibold">This is my business</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Claim it to edit details, upload photos, set pricing and accept bookings.
              </p>
              {!claiming && !claimId && (
                <Button className="mt-3 w-full" onClick={() => setClaiming(true)}>
                  Claim this property
                </Button>
              )}
              {claiming && !claimId && (
                <div className="mt-3 space-y-2">
                  <Label htmlFor="claim-email">Business email</Label>
                  <Input id="claim-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <Label htmlFor="claim-phone">Phone (optional)</Label>
                  <Input id="claim-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  <Button className="w-full" onClick={ensureAuthAndStart}>Send code</Button>
                </div>
              )}
              {claimId && (
                <div className="mt-3 space-y-2">
                  <Label htmlFor="claim-code">6-digit code</Label>
                  <Input id="claim-code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
                  {devCode && (
                    <p className="text-xs text-muted-foreground">Dev code: {devCode}</p>
                  )}
                  <Button className="w-full" onClick={submitCode}>Verify & claim</Button>
                </div>
              )}
            </div>

            {row.website && (
              <div className="rounded-xl border bg-card p-5">
                <h2 className="text-sm font-semibold">Public info</h2>
                <a href={row.website} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-2 text-sm text-primary hover:underline">
                  <Globe className="h-4 w-4" /> Website
                </a>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
