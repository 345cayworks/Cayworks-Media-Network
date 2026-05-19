# Cayworks Ad Engine — Tester Install Prompt

Paste the block below into the coding agent (Claude Code, etc.) running in
the host app's repo. Fill the four `<<...>>` placeholders first. The agent
gets a self-contained brief — it does not need prior context.

---

```
You are installing the Cayworks Ad Engine integration tester into this host
application. The tester is a single drop-in React component that verifies the
host can reach the engine, that auth/CORS work from this origin, that an ad
would actually serve for a given placement, and that the live plugin renders.

CONTEXT YOU NEED
- Engine base URL: <<https://ads.cayworks.com>>
- This platform's slug in the engine: <<platform-slug>>           e.g. asicayman
- A placement key to test: <<placement-key>>                      e.g. asi_dashboard_top
- A user role string to send: <<role>>                            e.g. MEMBER
- The platform API key must be read from a server-side env var named
  AD_ENGINE_KEY (or NEXT_PUBLIC_AD_ENGINE_KEY for a Next.js app with a
  domain-locked key) — never hardcode it.

WHAT TO BUILD
1. Add the engine plugin files to this repo if they're not already present:
     src/ad-engine/client.ts
     src/ad-engine/AdSlot.tsx
     src/ad-engine/variants.tsx
     src/ad-engine/AdEngineTester.tsx
     src/ad-engine/index.ts
   They are framework-agnostic React (no extra dependencies). The canonical
   source lives in the ad engine repo under src/plugin/. Copy them as-is and
   only adapt import style to match this repo's conventions.

2. Make AdEngineTester importable from src/ad-engine. It is a "use client"
   component with this signature:

   <AdEngineTester
     engineUrl={engine base URL}
     apiKey={platform API key}
     platform="<<platform-slug>>"
     placement="<<placement-key>>"
     userRole="<<role>>"
   />

   It runs four checks on mount — env config, GET /api/ads/serve, GET
   /api/ads/diagnose, and a live <AdSlot debug> mount — and renders a small
   status panel with green/red pills and a detail line per check.

3. Add a dedicated route/page that renders the tester. Choose the
   conventional location for this stack (e.g. for Next.js App Router:
   src/app/ads-test/page.tsx). Gate it behind a "staff" or "admin" auth
   check if one exists in this app; otherwise add a `noindex` meta tag and
   a short note that it must be removed before going to production.

   The page should:
   - Inject the engine URL and API key from env (server-side), never from
     a hardcoded literal.
   - Mount one <AdEngineTester /> for the placement above.
   - Optionally mount a second one for a different placement so multiple
     slots can be verified on one screen.

4. Add the required env vars to this app's env config + deployment secrets:
     <<ENV_VAR_FOR_ENGINE_URL>>=https://<engine-host>
     <<ENV_VAR_FOR_API_KEY>>=cae_live_…
   For a Next.js app these are typically NEXT_PUBLIC_AD_ENGINE_URL and
   NEXT_PUBLIC_AD_ENGINE_KEY. Remember NEXT_PUBLIC_* values are baked at
   build time — after setting them, redeploy.

5. Update this app's README with a short "Ad engine testing" section
   describing the route, the required env vars, and a reminder to remove
   or gate the route before going live.

CONSTRAINTS
- Do not invent a new request/response protocol — use exactly the endpoints
  the engine exposes: /api/ads/serve, /api/ads/diagnose, /api/ads/impression,
  /api/ads/click. Auth header is X-Ad-Engine-Key.
- Do not log or render the raw API key — only a 10-character prefix is fine.
- Do not block page render if the engine is unreachable. The tester must
  surface a failure check, not throw.
- Match this repo's existing styling/component conventions; the tester is
  framework-agnostic and uses inline styles so it works in any project.

ACCEPTANCE TEST
- The new route loads in this app's deployed environment.
- All four tester checks go green for the configured placement.
- The "Live <AdSlot> mount" section renders an actual ad (image, video, or
  card) — or the dashed debug placeholder pointing at /api/ads/diagnose if
  no eligible campaign is assigned to that placement.
- Network DevTools shows the requests going to the configured engine URL
  with the X-Ad-Engine-Key header attached.

DELIVERABLE
A pull request that adds the files above, the route, the env documentation,
and the README section — nothing else. Do not modify unrelated code.
```

---

## Filling the placeholders

| Placeholder | Where to get it |
|---|---|
| Engine base URL | Your deployed engine site URL (`NEXT_PUBLIC_AD_ENGINE_URL`) |
| platform-slug | `/admin/platforms` — exact slug for this host (`asicayman`, `cayrentmanager`, `clarityfinance`, …) |
| placement-key | A placement key on that platform — e.g. `asi_dashboard_top` |
| role | The user role string the host will send at runtime (`MEMBER`, `LANDLORD`, etc.) |
| API key | Generated on the engine's platform page (Regenerate API Key — shown once). Store as the host app's secret. |

When the agent finishes, open the new route in the deployed host app — all
four pills should be green. If any are red, the panel itself tells you which
stage failed; share that with the engine maintainer to resolve.
