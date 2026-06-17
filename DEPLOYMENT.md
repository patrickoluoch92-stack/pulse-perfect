# HostPulse — Deployment Guide

This guide covers production builds, environment configuration, and the
release checklist. HostPulse runs on TanStack Start v1 (Vite 7) targeting
an edge runtime (Cloudflare Workers / Lovable Cloud).

---

## 1. Environments

Three env files are recognized by Vite:

| File              | Loaded when                          | Committed? |
| ----------------- | ------------------------------------ | ---------- |
| `.env`            | always (defaults / shared)           | yes (no secrets) |
| `.env.development`| `vite dev` / `vite build --mode development` | no |
| `.env.production` | `vite build` (default mode)          | no |

Start from [`.env.example`](./.env.example) and copy into the matching file.

**Naming rules:**
- `VITE_*` — shipped to the browser. Safe for publishable keys, public URLs.
- Unprefixed — server-only. Read inside `createServerFn` handlers or route
  handlers via `process.env.X`. Never read at module scope (env binds per
  request on the Worker runtime).

Lovable Cloud projects don't need to set `SUPABASE_*` values manually — they
are injected. Self-hosted deployments must populate both client (`VITE_*`)
and server-side variants.

---

## 2. Production build verification

Run before every release:

```bash
bun install --frozen-lockfile
bun run lint
bun run test           # unit + integration (vitest)
bun run build          # production Vite build (mode=production)
```

Optional smoke tests against the built artifact:

```bash
bun run preview        # serves the production bundle locally
PLAYWRIGHT_BASE_URL=http://localhost:4173 bun run test:e2e -- --project=chromium
```

The build succeeds when:
- `vite build` exits 0 with no `Failed to resolve import` warnings.
- The SSR bundle compiles under `nodejs_compat` (no Node-only APIs leak in).
- `dist/` contains both `_server` (SSR entry) and client assets.

---

## 3. Coverage

```bash
bun run test -- --coverage
open coverage/index.html
```

Coverage targets (enforced in `vitest.config.ts`):

| Metric     | Threshold |
| ---------- | --------- |
| Lines      | 80%       |
| Functions  | 80%       |
| Statements | 80%       |
| Branches   | 75%       |

Server functions (`*.functions.ts`) and admin helpers (`*.server.ts`) are
excluded from coverage — they're exercised by integration + Playwright e2e
suites instead.

---

## 4. E2E suite

```bash
bun run test:e2e                        # all browsers
bun run test:e2e -- --project=chromium  # single browser
bun run test:e2e:ui                     # interactive runner
```

Test fixtures (`tests/e2e/fixtures/mock-auth.ts`) stub Supabase auth and
server-function responses so specs run hermetically without a live backend.
CI runs the chromium / firefox / webkit matrix in
[`.github/workflows/e2e.yml`](./.github/workflows/e2e.yml).

---

## 5. Publishing on Lovable Cloud

Frontend changes go live only after clicking **Publish → Update**.
Backend changes (migrations, server functions, edge functions) deploy
immediately on save.

After a first publish:
1. Rename the `*.lovable.app` slug under **Project settings → Domains** if
   desired.
2. Connect a custom domain from the same panel. DNS records are surfaced in
   the Domains UI once you start the flow.

---

## 6. Release checklist

- [ ] `bun run lint` clean
- [ ] `bun run test` green (no skipped tests for the feature shipped)
- [ ] `bun run test:e2e -- --project=chromium` green
- [ ] `bun run build` succeeds, bundle size delta reviewed
- [ ] Per-route meta + OG verified on changed pages
- [ ] Security scan reviewed — no unresolved critical findings
- [ ] Migration (if any) idempotent and reversible
- [ ] Backend secrets present in Lovable Cloud project settings
