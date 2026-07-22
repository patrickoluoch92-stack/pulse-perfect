import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/guides/hotel-seo")({
  head: () => ({
    meta: [
      { title: "Hotel SEO Guide — Win Direct Bookings | HostPulse" },
      {
        name: "description",
        content:
          "A practical SEO guide for hotels and lodges: local SEO, direct booking optimization, technical fundamentals, and keyword strategy for hospitality.",
      },
      { property: "og:title", content: "Hotel SEO Guide — Win Direct Bookings" },
      {
        property: "og:description",
        content:
          "Local SEO, direct bookings, technical fundamentals, and keyword strategy for hotels, lodges and resorts.",
      },
      { property: "og:type", content: "article" },
      {
        property: "og:url",
        content: "https://hostpulse-perfection.lovable.app/guides/hotel-seo",
      },
    ],
    links: [
      {
        rel: "canonical",
        href: "https://hostpulse-perfection.lovable.app/guides/hotel-seo",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Hotel SEO Guide — Win Direct Bookings",
          description:
            "A practical SEO guide for hotels and lodges covering local SEO, direct booking optimization, technical fundamentals, and keyword strategy.",
          author: { "@type": "Organization", name: "HostPulse" },
          publisher: { "@type": "Organization", name: "HostPulse" },
          mainEntityOfPage: "https://hostpulse-perfection.lovable.app/guides/hotel-seo",
        }),
      },
    ],
  }),
  component: HotelSeoGuide,
});

function HotelSeoGuide() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← HostPulse
          </Link>
          <Link to="/marketplace" className="text-sm text-primary hover:underline">
            Marketplace
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-16">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Guide
        </p>
        <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
          Hotel SEO: a practical guide to winning direct bookings
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          OTAs take 15–25% per booking. Search engines deliver guests at near-zero marginal cost —
          if your site is set up to be found. This is the playbook we recommend for hotels, lodges,
          camps and resorts.
        </p>

        <section className="prose prose-neutral mt-12 max-w-none dark:prose-invert">
          <h2>1. Local SEO is the foundation</h2>
          <p>
            Most hotel searches are local: <em>“hotels in Diani”</em>,<em>“Maasai Mara lodges”</em>,{" "}
            <em>“Naivasha resort with pool”</em>. Google answers them with a map pack, then organic
            results. To show up:
          </p>
          <ul>
            <li>
              Claim and verify your <strong>Google Business Profile</strong>. Use a consistent name,
              address and phone (NAP) everywhere online.
            </li>
            <li>
              Pick the most specific primary category (Hotel, Lodge, Resort, Guest House) and add
              every relevant secondary category.
            </li>
            <li>
              Upload 20+ high-quality photos: rooms, exterior, dining, amenities, local landmarks.
              Refresh quarterly.
            </li>
            <li>
              Encourage reviews from every checked-out guest and reply to each one — review velocity
              and response rate both move local rankings.
            </li>
          </ul>

          <h2>2. Optimize for direct bookings, not just traffic</h2>
          <p>
            Traffic that doesn’t book is vanity. Engineer every page toward a single conversion goal
            — checking availability:
          </p>
          <ul>
            <li>
              Put the booking widget <strong>above the fold</strong> on the home page and every room
              page.
            </li>
            <li>
              Match the lowest OTA rate, then add a direct-only perk: free breakfast, late checkout,
              airport pickup, room upgrade.
            </li>
            <li>
              Build a dedicated <em>“Best rate guarantee”</em> page and link it from the header. It
              is one of the highest-intent queries you can own.
            </li>
            <li>
              Add trust signals near the CTA: review score, secure payment badges, cancellation
              terms.
            </li>
          </ul>

          <h2>3. Keyword strategy for hospitality</h2>
          <p>Build pages around the three intent layers guests move through:</p>
          <ul>
            <li>
              <strong>Discovery</strong>: <em>“things to do in Lamu”</em>,
              <em>“best time to visit Amboseli”</em>. Long-form area guides.
            </li>
            <li>
              <strong>Comparison</strong>: <em>“boutique hotels Karen”</em>,
              <em>“family resorts Mombasa”</em>. Category landing pages.
            </li>
            <li>
              <strong>Transactional</strong>: <em>“{`{your brand}`} book direct”</em>,
              <em>“{`{your brand}`} discount code”</em>. Brand-protection pages.
            </li>
          </ul>
          <p>
            Map each query to one URL — never two — and add internal links from discovery →
            comparison → transactional pages.
          </p>

          <h2>4. Technical fundamentals you cannot skip</h2>
          <ul>
            <li>
              <strong>Schema markup</strong>: add <code>Hotel</code> and{" "}
              <code>LodgingBusiness</code> JSON-LD with address, geo, price range, amenities and
              aggregate rating.
            </li>
            <li>
              <strong>Speed</strong>: compress hero photos to WebP/AVIF under 200KB. Aim for Largest
              Contentful Paint under 2.5s on 4G.
            </li>
            <li>
              <strong>Mobile</strong>: 70%+ of hospitality search is mobile. Test every page at
              375px width — tap targets ≥ 44px, no horizontal scroll.
            </li>
            <li>
              <strong>Sitemap and robots</strong>: submit <code>/sitemap.xml</code> in Google Search
              Console and reference it from <code>/robots.txt</code>.
            </li>
            <li>
              <strong>HTTPS and canonical tags</strong>: one canonical version per page, no mixed
              content.
            </li>
          </ul>

          <h2>5. Content that earns links</h2>
          <p>
            Backlinks remain the single biggest ranking signal. Hotels earn them best with
            destination expertise, not press releases:
          </p>
          <ul>
            <li>
              Write definitive area guides (<em>“What to do in Watamu — a local’s guide”</em>) that
              travel bloggers cite.
            </li>
            <li>
              Partner with safari operators, dive schools and wedding planners for two-way links.
            </li>
            <li>
              Get listed on credible directories: HostPulse marketplace, tourism board sites,
              regional travel associations.
            </li>
          </ul>

          <h2>6. Measure what matters</h2>
          <ul>
            <li>
              <strong>Direct booking share</strong> — % of reservations from your own site vs OTAs.
              This is the only number that proves SEO is working.
            </li>
            <li>
              <strong>Booking-engine conversion rate</strong> — visitors who hit the availability
              search ÷ confirmed bookings.
            </li>
            <li>
              <strong>Branded vs non-branded clicks</strong> in Search Console. Non-branded growth
              means you’re reaching new guests.
            </li>
          </ul>

          <h2>Ready to go further?</h2>
          <p>
            List your property in the{" "}
            <Link to="/marketplace" className="text-primary underline">
              HostPulse marketplace
            </Link>{" "}
            for a verified profile and a high-authority backlink to your direct booking page, or{" "}
            <Link to="/pricing" className="text-primary underline">
              start a free trial
            </Link>{" "}
            to manage availability, channels and guests in one place.
          </p>
        </section>
      </article>
    </div>
  );
}
