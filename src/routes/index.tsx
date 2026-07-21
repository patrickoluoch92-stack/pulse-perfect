import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BedDouble, Calendar, ChartBar, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HostPulse — Hospitality operations, all in one place" },
      {
        name: "description",
        content:
          "Run your hotel, lodge, vacation rental, or tour business from a single workspace. Reservations, housekeeping, billing, and analytics.",
      },
      { property: "og:title", content: "HostPulse — Hospitality operations" },
      {
        property: "og:description",
        content: "Reservations, housekeeping, billing, and analytics for modern hosts.",
      },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "HostPulse",
          description:
            "Hospitality operations for hosts, hotels, lodges, and tour operators.",
        }),
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-dvh bg-background">
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
              <Link to="/marketplace">Stays</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/mobility">Mobility</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/professionals">Professionals</Link>
            </Button>
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

      <main>
        <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 text-center">
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            For hosts, hotels, lodges & tour operators
          </p>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
            Hospitality, <span className="text-primary italic">orchestrated.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            HostPulse brings reservations, rooms, housekeeping, billing, and analytics into a
            single calm workspace — built for teams that care about the guest experience.
          </p>
          <div className="mt-10 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/auth" search={{ mode: "signup" }}>Start free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 pb-24 md:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-accent/15 text-accent">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} HostPulse. Crafted for hospitality.
      </footer>
    </div>
  );
}

const features = [
  { icon: BedDouble, title: "Properties & units", body: "Model hotels, lodges, vacation rentals, and tour slots side by side — multi-tenant from day one." },
  { icon: Calendar, title: "Reservations", body: "Bookings, modifications, cancellations, no-shows — with guest profiles and check-in flow." },
  { icon: ChartBar, title: "Analytics", body: "Occupancy, revenue, ADR, RevPAR. Know what's working without spreadsheets." },
];
