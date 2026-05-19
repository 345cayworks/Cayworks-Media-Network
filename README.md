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
npm run db:seed               # superadmin + CayRentManager + sample data
npm run dev                   # http://localhost:3000
```

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
| `SEED_SUPERADMIN_EMAIL` / `SEED_SUPERADMIN_PASSWORD` | Seed bootstrap admin |

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

### Ad selection logic

Active placement → active campaigns in flight dates → drop campaigns over
daily/total impression caps or with on-hold billing → optional category
bias (advertiser industry) → weighted-random pick by
`campaign.priority × campaignPlacement.weight` → one approved+active creative.

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
