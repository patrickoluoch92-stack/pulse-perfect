import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Smartphone, CreditCard } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWorkspaceContext } from "@/lib/workspace.functions";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { MpesaCheckoutDialog } from "@/components/MpesaCheckoutDialog";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { MPESA_PLAN_PRICES } from "@/lib/mpesa.server.types";
import { toast } from "sonner";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — HostPulse" },
      { name: "description", content: "Simple, transparent pricing for hosts, hotels, lodges, and tour operators. Start free, scale as you grow. Pay with card or M-PESA." },
      { property: "og:title", content: "Pricing — HostPulse" },
      { property: "og:description", content: "Simple, transparent pricing. Card or M-PESA. 14-day free trial." },
      { property: "og:url", content: "/pricing" },
      { property: "og:type", content: "product" },
    ],
    links: [{ rel: "canonical", href: "/pricing" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org", "@type": "Product", name: "HostPulse",
        description: "Hospitality operations platform — reservations, housekeeping, billing, analytics, and tours.",
        offers: [
          { "@type": "Offer", name: "Starter", price: "0", priceCurrency: "USD" },
          { "@type": "Offer", name: "Professional", price: "49", priceCurrency: "USD" },
          { "@type": "Offer", name: "Business", price: "149", priceCurrency: "USD" },
        ],
      }),
    }],
  }),
  component: PricingPage,
});

type PlanKey = "starter" | "professional" | "business" | "enterprise";
interface Tier {
  key: PlanKey;
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  features: string[];
  featured?: boolean;
  paddlePriceId?: string;
  mpesaPlan?: "professional" | "business";
}

const tiers: Tier[] = [
  { key: "starter", name: "Starter", price: "$0", cadence: "forever",
    blurb: "For new hosts validating their first property.",
    features: ["1 property, up to 3 units", "Reservations & calendar", "iCal sync (1 source)", "Community support"] },
  { key: "professional", name: "Professional", price: "$49", cadence: "per month",
    blurb: "For operators running a real, growing business.", featured: true,
    paddlePriceId: "professional_monthly", mpesaPlan: "professional",
    features: ["Up to 10 properties", "Housekeeping & guest profiles", "Invoicing & payments", "iCal sync + webhooks", "Email support", "14-day free trial"] },
  { key: "business", name: "Business", price: "$149", cadence: "per month",
    blurb: "Teams, tour operators, and multi-brand portfolios.",
    paddlePriceId: "business_monthly", mpesaPlan: "business",
    features: ["Unlimited properties", "Tour operator module", "Roles, SSO & MFA", "Audit exports & SLAs", "Priority support", "14-day free trial"] },
  { key: "enterprise", name: "Enterprise", price: "Custom", cadence: "contact sales",
    blurb: "Custom contracts, dedicated infrastructure, and white-glove onboarding.",
    features: ["Everything in Business", "Dedicated support engineer", "Custom SLAs & DPA", "Volume discount"] },
];

function PricingPage() {
  const fetchCtx = useServerFn(getWorkspaceContext);
  const ctx = useQuery({ queryKey: ["workspace-context-pricing"], queryFn: () => fetchCtx(), retry: false });
  const user = ctx.data?.profile;
  const orgId = ctx.data?.currentOrg?.id;

  const { openCheckout, loading } = usePaddleCheckout();
  const [mpesa, setMpesa] = useState<{ plan: "professional" | "business"; amount: number } | null>(null);

  const onCardCheckout = async (tier: Tier) => {
    if (!user || !orgId) {
      window.location.href = "/auth?mode=signup";
      return;
    }
    if (!tier.paddlePriceId) return;
    try {
      await openCheckout({
        priceId: tier.paddlePriceId,
        customerEmail: ctx.data?.user?.email ?? undefined,
        customData: { userId: user.id, orgId },
        successUrl: `${window.location.origin}/dashboard?checkout=success&plan=${tier.key}`,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to open checkout");
    }
  };

  const onMpesaClick = (tier: Tier) => {
    if (!user || !orgId) { window.location.href = "/auth?mode=signup"; return; }
    if (!tier.mpesaPlan) return;
    setMpesa({ plan: tier.mpesaPlan, amount: MPESA_PLAN_PRICES[tier.mpesaPlan] });
  };

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="font-display text-xl font-semibold tracking-tight">HostPulse</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost"><Link to="/pricing">Pricing</Link></Button>
            <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
            <Button asChild><Link to="/auth" search={{ mode: "signup" }}>Get started</Link></Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-20 pb-24">
        <div className="text-center">
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">Pricing</p>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
            Simple pricing.<br />
            <span className="text-primary italic">Honest math.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            14-day free trial on paid plans. Pay with card or M-PESA. No per-booking fees.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {tiers.map((t) => (
            <div key={t.key}
              className={"rounded-2xl border p-6 shadow-sm transition-shadow hover:shadow-md " +
                (t.featured ? "border-primary bg-card ring-2 ring-primary/20" : "border-border/60 bg-card")}>
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-xl font-semibold">{t.name}</h3>
                {t.featured && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Popular</span>}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{t.blurb}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-display text-4xl font-semibold">{t.price}</span>
                <span className="text-sm text-muted-foreground">/ {t.cadence}</span>
              </div>
              <ul className="mt-6 space-y-2 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 space-y-2">
                {t.key === "starter" && (
                  <Button asChild className="w-full" variant="outline">
                    <Link to="/auth" search={{ mode: "signup" }}>Start free</Link>
                  </Button>
                )}
                {t.paddlePriceId && (
                  <Button onClick={() => onCardCheckout(t)} disabled={loading} className="w-full" variant={t.featured ? "default" : "outline"}>
                    <CreditCard className="h-4 w-4" /> Pay with card
                  </Button>
                )}
                {t.mpesaPlan && (
                  <Button onClick={() => onMpesaClick(t)} className="w-full" variant="secondary">
                    <Smartphone className="h-4 w-4" /> Pay with M-PESA
                  </Button>
                )}
                {t.key === "enterprise" && (
                  <Button asChild className="w-full" variant="outline">
                    <a href="mailto:sales@hostpulse.app?subject=Enterprise plan inquiry">Contact sales</a>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <section className="mt-24">
          <h2 className="font-display text-3xl font-semibold tracking-tight">Frequently asked questions</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            {faqs.map((f) => (
              <div key={f.q} className="rounded-xl border border-border/60 bg-card p-5">
                <h3 className="font-medium">{f.q}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} HostPulse. Crafted for hospitality.
      </footer>

      {mpesa && orgId && (
        <MpesaCheckoutDialog open onOpenChange={(o) => !o && setMpesa(null)}
          orgId={orgId} plan={mpesa.plan} amountKes={mpesa.amount} />
      )}
    </div>
  );
}

const faqs = [
  { q: "Is there a free trial?", a: "Yes — 14 days on Professional and Business. No card required." },
  { q: "Can I pay with M-PESA?", a: "Yes. Choose 'Pay with M-PESA' on any paid plan to get an STK Push to your phone. Charged in KES (≈$49 → KES 6,500, $149 → KES 19,500)." },
  { q: "Do you charge per booking?", a: "No. Pricing is per workspace, not per reservation." },
  { q: "Can I cancel anytime?", a: "Yes. Card subscriptions cancel from your billing settings; M-PESA payments are monthly and simply expire if you don't renew." },
];
