# HostPulse Brand & Design Language Guide

A living document. HostPulse 2.0 is a premium, enterprise-grade platform for
hospitality, mobility, and marketplace operations. Every surface should feel
like part of one product — trustworthy, intelligent, and calm.

## 1. Brand Pillars

Trust · Intelligence · Innovation · Simplicity · Professionalism · Hospitality · Mobility · Enterprise readiness.

Reference bar: Airbnb, Stripe, Notion, Linear, Microsoft, Google Workspace.

## 2. Color System

All colors ship as semantic tokens in `src/styles.css`. **Never hardcode hex
values or `text-white` / `bg-black` in components** — always use tokens.

| Role | Token / Utility | Hex | Usage |
| --- | --- | --- | --- |
| Primary — Deep Royal Blue | `bg-primary` `text-primary` | `#1E3A8A` | Logo, primary buttons, active nav, headers |
| Interactive — Modern Blue | `bg-accent` `text-accent` | `#2563EB` | Links, highlights, focus rings, progress |
| Success — Emerald | `bg-success` `text-success` | `#10B981` | Confirmations, availability, positive metrics |
| **AI — Purple (reserved)** | `bg-ai` `text-ai` `ai-surface` `ai-badge` | `#7C3AED` | HIOS, Concierge, Recommendations, Insights |
| Warning — Amber | `bg-warning` | `#F59E0B` | Non-blocking warnings |
| Destructive — Red | `bg-destructive` | `#EF4444` | Errors, destructive actions |
| Background | `bg-background` | `#F8FAFC` | App canvas |
| Card | `bg-card` | `#FFFFFF` | Surface elevation |
| Text | `text-foreground` | `#1F2937` | Primary text |

**AI rule**: `--ai` / `bg-ai` / `.ai-surface` / `.ai-badge` are reserved for
AI-powered features. Nothing else may use purple, so users instantly recognize
intelligence surfaces.

## 3. Typography

Single family: **Inter** (400/500/600/700/800), loaded from Google Fonts in
`src/routes/__root.tsx`. Both `--font-sans` and `--font-display` point at Inter
for one consistent voice.

| Level | Tailwind | Weight | Tracking |
| --- | --- | --- | --- |
| Hero | `text-5xl md:text-6xl` | 700 | `-0.02em` |
| H1 | `text-4xl` | 600 | `-0.02em` |
| H2 | `text-2xl` | 600 | `-0.02em` |
| H3 | `text-xl` | 600 | `-0.01em` |
| H4 | `text-lg` | 600 | `-0.01em` |
| Body | `text-sm` / `text-base` | 400 | normal |
| Caption | `text-xs` | 500 | `0.01em` |

## 4. Spacing & Layout

- 4-pt base grid; prefer `gap-2 / gap-4 / gap-6 / gap-8`.
- Card padding: `p-6` desktop, `p-4` mobile.
- Section spacing: `space-y-6` inside a dashboard column; `space-y-10` between hero sections.
- Max content widths: `max-w-6xl` marketing, `max-w-7xl` dashboards.
- Radius scale: `--radius: 0.625rem`. Use `rounded-lg` (cards), `rounded-md` (inputs, buttons), `rounded-full` (pills, avatars).

## 5. Components

All primitives live in `src/components/ui/*` (shadcn). Never re-implement — extend via variants.

- **Buttons**: `default` (primary), `secondary`, `outline`, `ghost`, `destructive`. Icon-only buttons must set `aria-label`.
- **Cards**: `rounded-lg border border-border bg-card shadow-sm`.
- **KPI widgets**: label (`text-xs uppercase tracking-wider text-muted-foreground`), value (`text-2xl font-semibold`), delta chip in `success`/`destructive`.
- **Charts**: use `--chart-1..5` tokens (blue, emerald, purple, amber, red).
- **Empty / Loading**: always via shared `LoadingState` / `EmptyState` primitives.
- **AI surfaces**: wrap in `.ai-surface`; tag AI actions with `.ai-badge` + a `Sparkles` icon.

## 6. Navigation

One sidebar (`src/components/dashboard-shell.tsx`) grouped Operate · Marketplace · AI Studio · Finance · Team · Platform Admin. Active items use `bg-sidebar-accent text-sidebar-accent-foreground font-medium`. Provide breadcrumbs on any route two levels deep.

## 7. Dashboards

Every dashboard (Executive, Business, Property, Hotel, Mobility, Marketplace, Finance, future HIOS) shares:

1. Page header — title, subtitle, primary actions right-aligned.
2. KPI row — 3–5 stat cards.
3. Insight row — one chart + one AI insight panel (`.ai-surface`).
4. Data table / list with consistent filters, sorting, pagination.

## 8. Forms

- Labels above inputs, `text-sm font-medium`.
- Inline validation errors in `text-destructive text-xs mt-1`.
- Long forms > 6 fields become multi-step wizards with a progress rail.
- Autosave silently; toast on success/failure via `sonner`.

## 9. Listings (Property · Hotel · Vehicle · Tour · Business)

- Image ratio `aspect-[4/3]`, `object-cover`, lazy loaded.
- Title (`text-base font-semibold`), meta (`text-xs text-muted-foreground`), price (`text-lg font-semibold`), rating chip, verification badge, CTA button.
- Status badges: `Available` (success), `Booked` (accent), `Pending` (warning), `Archived` (muted).

## 10. Mobile

- Design mobile-first; test at 375px.
- Use `h-dvh` for full-height layouts.
- Tap targets ≥ 44×44.
- Drawer nav collapses at `< lg` breakpoint.

## 11. Micro-interactions

- Transitions ≤ 200ms, `ease-out`.
- Hover: lift with `hover:shadow-md transition-shadow`.
- Focus: visible `ring-2 ring-ring ring-offset-2`.
- Loading: shimmer skeleton, not spinners, for content.

## 12. Accessibility (WCAG AA)

- Contrast ≥ 4.5:1 for body text; the token pairs above are pre-checked.
- Every icon-only control has `aria-label`.
- Keyboard: all interactive elements reachable via Tab; visible focus.
- One `<main>` per route; heading levels never skip.
- Prefer Radix / shadcn primitives — ARIA is correct out of the box.

## 13. Performance

- Route-level code splitting via TanStack Start.
- Heavy libs (`recharts`, `react-markdown`) lazy-loaded via `src/components/lazy/*`.
- Images: `loading="lazy"`, explicit `width`/`height`, `object-cover`.
- Preload routes on link intent (`defaultPreload: "intent"`).

## 14. Do / Don't

**Do**
- Use tokens for every color, radius, and shadow.
- Reserve purple exclusively for AI.
- Prefer shadcn primitives over custom widgets.

**Don't**
- Ship raw hex values, `text-white`, or `bg-black` in components.
- Use purple for non-AI surfaces.
- Introduce a second font family.
- Add gratuitous gradients or animations.

## 15. Governance

This guide is the source of truth. Any new module must adhere before merge.
Update this file alongside token or component changes so it stays living.
