# Mobile Responsiveness Audit

HostPulse targets phones first (375–458 CSS px) and scales up. This is the
working checklist applied across the marketplace, dashboard, and admin
surfaces.

## Global rules
- Use the `grid-cols-[minmax(0,1fr)_auto]` → `sm:flex` pattern for header
  rows that mix headings with action widgets (see `responsive-layout-patterns`).
- Every flex/grid text container gets `min-w-0`; long headings get `truncate`.
- Tap targets ≥ 44×44px. Buttons keep `h-10`+ on mobile.
- No horizontal overflow at 375px.

## Audited surfaces
| Surface                              | Status | Notes                                              |
| ------------------------------------ | ------ | -------------------------------------------------- |
| Landing `/`                          | ✅      | Stacks hero CTAs vertically below `sm`             |
| Marketplace index                    | ✅      | Filters wrap; cards 1-col → 2-col → 3-col grid     |
| Property detail `/marketplace/p/$`   | ✅      | Booking sidebar moves below content on mobile      |
| Map view `/marketplace/map`          | ✅      | Filters collapse into a sheet on `<md`             |
| Bookings `/bookings`                 | ✅      | Card list on mobile, table on `md+`                |
| Admin listings                       | ✅      | Horizontal scroll on tables; sticky first column   |
| Listing edit + import                | ✅      | Forms single column on mobile                      |
| Auth pages                           | ✅      | Centered card, full-width inputs                   |

## Smoke test commands
- Preview at 458×682 (current device) and 375×667 (iPhone SE).
- Inspect with Playwright: see `browser-use` docs in the agent guide.
