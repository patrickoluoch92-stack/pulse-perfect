import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — HostPulse" },
      {
        name: "description",
        content:
          "Simple, transparent pricing for hosts, hotels, lodges, and tour operators. Start free, scale as you grow.",
      },
      { property: "og:title", content: "Pricing — HostPulse" },
      {
        property: "og:description",
        content: "Simple, transparent pricing. Start free, scale as you grow.",
      },
      { property: "og:url", content: "/pricing" },
      { property: "og:type", content: "product" },
    ],
    links: [{ rel: "canonical", href: "/pricing" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: "HostPulse",
          description:
            "Hospitality operations platform — reservations, housekeeping, billing, analytics, and tours.",
          offers: [
            {
              "@type": "Offer",
              name: "Starter",
              price: "0",
              priceCurrency: "USD",
            },
            {
              "@type": "Offer",
              name: "Growth",
              price: "49",
              priceCurrency: "USD",
            },
            {
              "@type": "Offer",
              name: "Scale",
              price: "149",
              priceCurrency: "USD",
            },
          ],
        }),
      },
    ],
  }),
  component: PricingPage,
});

const tiers = [
  {
    name: "Starter",
    price: "$0",
    cadence: "forever",
    blurb: "For new hosts validating their first property.",
    features: [
      "1 property, up to 3 units",
      "Reservations & calendar",
      "iCal sync (1 source)",
      "Community support",
    ],
    cta: "Start free",
    featured: false,
  },
  {
    name: "Growth",
    price: "$49",
    cadence: "per month",
    blurb: "For operators running a real, growing business.",
    features: [
      "Up to 10 properties",
      "Housekeeping & guest profiles",
      "Invoicing & payments",
      "iCal sync + webhooks",
      "Email support",
    ],
    cta: "Start Growth",
    featured: true,
  },
  {
    name: "Scale",
    price: "$149",
    cadence: "per month",
    blurb: "Teams, tour operators, and multi-brand portfolios.",
    features: [
      "Unlimited properties",
      "Tour operator module",
      "Roles, SSO & MFA",
      "Audit exports & SLAs",
      "Priority support",
    ],
    cta: "Talk to sales",
    featured: false,
  },
];

function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="font-display text-xl font-semibold tracking-tight">HostPulse</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link to="/pricing">Pricing</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild>
              <Link to="/auth" search={{ mode: "signup" }}>Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-20 pb-24">
        <div className="text-center">
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Pricing
          </p>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
            Simple pricing.<br />
            <span className="text-primary italic">Honest math.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            No per-booking fees. No surprise add-ons. Cancel anytime.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={
                "rounded-2xl border p-6 shadow-sm transition-shadow hover:shadow-md " +
                (t.featured
                  ? "border-primary bg-card ring-2 ring-primary/20"
                  : "border-border/60 bg-card")
              }
            >
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-xl font-semibold">{t.name}</h3>
                {t.featured && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Popular
                  </span>
                )}
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
              <Button
                asChild
                className="mt-8 w-full"
                variant={t.featured ? "default" : "outline"}
              >
                <Link to="/auth" search={{ mode: "signup" }}>{t.cta}</Link>
              </Button>
            </div>
          ))}
        </div>

        <section className="mt-24">
          <h2 className="font-display text-3xl font-semibold tracking-tight">
            Frequently asked questions
          </h2>
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
    </div>
  );
}

const faqs = [
  { q: "Is there a free trial?", a: "Starter is free forever. Growth and Scale offer a 14-day trial — no card required." },
  { q: "Do you charge per booking?", a: "No. Pricing is per workspace, not per reservation." },
  { q: "Can I cancel anytime?", a: "Yes. You can downgrade or cancel from your billing settings." },
  { q: "Do you offer SSO and MFA?", a: "Yes — both TOTP and SMS MFA are included on Scale, plus SAML SSO." },
];
