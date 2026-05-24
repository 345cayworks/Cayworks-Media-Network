# Cayworks Ad Engine

A centralized advertising backend and reusable ad-network plugin for the
Cayworks platform family (CayRentManager, Clarity Finance, CIREME/MLS, ASI
Cayman Portal, CayTech Global, and future client sites).

Manage advertisers, campaigns, creatives, placements, targeting, impressions,
clicks, billing and reporting from one admin backend. Any partner app connects
with an API key and requests ads for named placements.

---

## Stack

- **Next.js 14** (App Router) — admin UI + serverless API routes
- **Prisma + PostgreSQL** — data model and migrations
- **Tailwind CSS** — compact, responsive admin UI
- **Netlify-compatible** (`@netlify/plugin-nextjs`)
- Lightweight JWT cookie auth with role-based access control

## Quick start

```bash
cp .env.example .env          # then edit values
npm install
npm run db:push               # create schema in your Postgres
npm run db:seed               # superadmin + platforms + sample data
npm run dev                   # http://localhost:3000
```

### Deploying without local CLI access

`npm run build` runs `prisma migrate deploy`, so **migrations apply
automatically on every Netlify deploy** (set `DATABASE_URL` in the site
env so it's present at build time).

To seed without the CLI, POST to the key-protected bootstrap endpoint once
after the deploy is live:

```bash
curl -X POST "https://your-site/api/bootstrap" -H "X-Bootstrap-Key: $SUPERADMIN_MASTER_KEY"
```

It is idempotent and returns the API keys for any newly created platforms
(save them — shown once). `GET /api/health` reports config/DB status.

`npm run db:seed` is idempotent and bakes in three platforms —
**CayRentManager**, **ASI Cayman Portal** (`asicayman`) and **Clarity
Finance** (`clarityfinance`) — with default placements and sample
campaigns. It prints the bootstrap superadmin credentials and each
platform's API key (shown once). Sign in at `/login`.

Each platform can be switched on/off instantly from the **dashboard** or
the Platforms page (no redeploy) — an INACTIVE platform's API key is
rejected at `/api/ads/serve`, so its ads stop serving network-wide.

### Environment variables

| Var | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Long random string; signs admin session JWTs + hashes IPs |
| `NEXT_PUBLIC_AD_ENGINE_URL` | Public base URL (used in snippets) |
| `SUPER_ADMIN_EMAIL` / `SUPERADMIN_MASTER_KEY` | Bootstrap master superadmin account |

## Roles

`SUPERADMIN`, `AD_ADMIN`, `SALES_REP`, `ADVERTISER`, `PLATFORM_OWNER`,
`REPORT_VIEWER`. Admin routes are protected by middleware; creative approval
and platform/API-key management are restricted to admin roles. Major actions
are written to an append-only **audit log** (`/admin/audit`).

## Admin features

- Dashboard: advertisers, active campaigns, monthly revenue, impressions,
  clicks, CTR, expiring campaigns, pending creatives
- Advertiser / Campaign / Creative / Platform / Placement CRUD
- Placement assignment with per-placement weights and priority
- Creative approval workflow + live preview
- Reporting by campaign / platform / placement with date filters + CSV export

---

## Connecting another platform to the ad engine

### 1. Register the platform (admin)

`/admin/platforms → Register Platform`. Set a slug (e.g. `clarityfinance`)
and optional allowed domains. **Copy the API key — it is shown once** and only
its SHA-256 hash is stored. Regenerate any time from the platform page.

### 2. Define placements

On the platform page, add placement keys, e.g.
`landlord_dashboard_top`, `tenant_portal_sidebar`. Assign campaigns to
placements from the campaign page.

### 3. Embed the plugin

Copy `src/plugin/` into the partner app (or publish it as an internal
package) and render a slot. Inject the API key **server-side** — never hard-code
it in client bundles in production.

```tsx
import { AdSlot, AdBanner, SponsoredCard, NativeAd } from "@/plugin";

<AdSlot
  engineUrl="https://ads.cayworks.com"
  apiKey={process.env.AD_ENGINE_KEY!}
  platform="cayrentmanager"
  placement="landlord_dashboard_top"
  userRole="LANDLORD"
  category="property-management"
/>
```

The component fetches an ad, renders it, records an impression once it is
≥50% visible, records a click (and opens the safe destination), and renders
nothing when no ad is eligible. Variants: `<AdBanner>`, `<SponsoredCard>`,
`<NativeAd>`. Disclosure labels rotate ("Sponsored Local Partner",
"Recommended Service", "Featured Vendor", "Partner Offer").

A working reference integration lives at
`/demo/cayrentmanager?key=YOUR_API_KEY`.

### 4. Or call the HTTP API directly

Pass the key as `X-Ad-Engine-Key` header (or `?apiKey=` / `Bearer`).

| Endpoint | Method | Notes |
|---|---|---|
| `/api/ads/serve` | GET | `platform, placement, userRole, category?, pageUrl?` → `{ ad }` or `{ ad: null }` |
| `/api/ads/impression` | POST | record a served impression |
| `/api/ads/click` | POST | record click, returns safe `destinationUrl` |
| `/api/ads/click` | GET | redirect-style: 302 to sanitized destination |
| `/api/ads/reporting` | GET | **admin session required**; `groupBy`, `from`, `to`, `format=csv` |

```bash
curl "https://ads.cayworks.com/api/ads/serve?platform=cayrentmanager&placement=landlord_dashboard_top&userRole=LANDLORD" \
  -H "X-Ad-Engine-Key: cae_live_..."
```

### Skyscraper placement type + dimension-fit selection

`PlacementType.SKYSCRAPER` (180x600) is selectable on any placement
alongside `BANNER`, `SIDEBAR`, `CARD`, `NATIVE`, `VIDEO`. Selection now
**prefers creatives whose dimensions match the placement** (within ±15%):

- Uses the placement's `allowedSizes` if set (e.g. `180x600, 160x600`),
  otherwise the type's defaults — `SKYSCRAPER → 180x600`,
  `BANNER → 728x90 / 970x90 / 300x250`, `SIDEBAR → 300x600 / 300x250`,
  `CARD → 300x250`.
- Best-fit creatives are picked first; if none match, the slot still
  serves an eligible creative rather than going dark.
- A new `<SkyscraperAd>` plugin preset renders a 180x600 unit fluidly
  (aspectRatio 180/600, 180px max width).

### Responsive sizing

Slots are **fluid by default** — the wrapper fills 100% of its container, so
ads scale with the screen. Control the shape with optional props:

```tsx
{/* fills the column, keeps a 728x90-ish banner shape on every width */}
<AdBanner {...ad} placement="..." aspectRatio="728/90" fit="cover" />

{/* cap the width and letterbox instead of crop */}
<AdBanner {...ad} placement="..." maxWidth={970} fit="contain" />

{/* fixed height, stretch the image to fill exactly */}
<AdSlot {...ad} placement="..." height={120} fit="fill" />
```

- `aspectRatio` (e.g. `"16/9"`, `"728/90"`) — reserves the box and avoids
  layout shift; defaults to the creative's stored width/height, then to the
  image's natural ratio.
- `fit` — `"cover"` (fill + crop, default), `"contain"` (letterbox), `"fill"`
  (stretch to fit exactly).
- `height` — fixed CSS height (overrides `aspectRatio`).
- `maxWidth` — cap the slot; otherwise it expands to the container.

Video defaults to 16/9 and also fills its width. The card thumbnail scales
with the card and stays square.

### Timed rotation

Add `rotateSeconds` to any slot to cycle multiple ads on a timer:

```tsx
<AdSlot platform="asicayman" placement="asi_dashboard_top"
        rotateSeconds={15} userRole="MEMBER" engineUrl={...} apiKey={...} />
```

The server builds a weighted rotation queue (`GET /api/ads/serve?count=N`,
returns `{ ads: [...] }`) using **smooth weighted round-robin**: a campaign
with effective weight W appears ~W× more often than a weight-1 campaign, but
interleaved (no back-to-back repeats when more than one campaign is
eligible). Effective weight = `priority × placementWeight`. The client cycles
the queue, pauses while the tab is hidden, refreshes the queue every 5
minutes, and logs **one impression per on-screen rotation**. Omitting
`rotateSeconds`/`count` preserves the original single-ad behavior.

### Per-user frequency capping

Each campaign has optional **Frequency Caps** — per user **per hour** (rolling
60-minute window) and **per day** (UTC). When set, a given anonymous user
won't be shown that campaign more than N times in that window — the campaign
is simply skipped in selection once a cap is reached for that user (others
still see it). Both caps apply together when both are set. The plugin sends a stable `anonymousUserId`
(localStorage) on every serve request; server-to-server callers without one
are not capped. `/api/ads/diagnose?...&anonymousUserId=<id>` reports the cap
status per campaign.

### Ad selection logic

Active placement → active campaigns in flight dates → drop campaigns over
daily/total impression caps or with on-hold billing → optional category
bias (advertiser industry) → weighted-random pick by
`campaign.priority × campaignPlacement.weight` → one approved+active creative.

## Creative media

- **Images:** paste a URL or upload directly. Direct upload uses Cloudinary
  unsigned upload (set `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` +
  `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`); the delivery URL is stored, so the
  backend stays stateless/serverless-friendly.
- **Video:** paste a **YouTube** link (rendered as a privacy-friendly embed)
  or a direct/Cloudinary `.mp4` (HTML5 player), or upload a file. Video ads
  render the player plus a tracked CTA button. Plugin preset: `<VideoAd>`.

## Security

- API keys hashed (SHA-256); raw key revealed exactly once via short-lived
  httpOnly cookie
- Admin routes behind JWT middleware; RBAC on sensitive actions
- Click destinations always read from the stored creative and sanitized
  (http/https only) to prevent open redirects
- Client IPs are salted-hashed, never stored raw
- Graceful empty fallback so a missing ad never breaks the host page

## Deploy to Netlify

Connect the repo, set the environment variables, and deploy. `netlify.toml`
wires the official Next.js runtime so API routes run as functions. Run
`prisma migrate deploy` against your production database during release.

## Roadmap

- **Phase 4** — billing/invoicing, Fygaro payment links (`Invoice.fygaroLinkUrl`
  reserved), campaign renewal reminders
- **Phase 5** — CayTech digital-screen placements, proof-of-play reporting,
  20-second video creative scheduling

## Project layout

```
prisma/schema.prisma         data model + enums
prisma/seed.ts               superadmin, CayRentManager, sample data
src/app/api/ads/*            serve / impression / click / reporting
src/app/admin/*              dashboard + CRUD (server actions)
src/lib/*                    auth, api-key, ad-selection, reporting, audit
src/plugin/*                 AdSlot, AdBanner, SponsoredCard, NativeAd
src/app/demo/cayrentmanager  reference integration
```
