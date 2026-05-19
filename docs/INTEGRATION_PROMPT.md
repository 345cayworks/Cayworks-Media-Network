# Cayworks Ad Engine — Reusable Integration Prompt

Copy everything in the code block below into the coding agent (Claude Code,
etc.) working in a Cayworks platform repo. Fill in the four `<<...>>`
placeholders first. The prompt is self-contained — the agent does not need
prior context about the ad engine.

---

```
You are integrating this application with the Cayworks Ad Engine, a
centralized ad network that serves ads for named "placements" via an API key.

CONTEXT YOU NEED
- Ad Engine base URL: <<https://ads.cayworks.com>>
- This platform's slug (already registered in the ad engine): <<platform-slug>>
- Placement keys this app should render (key + where it lives in the UI):
  <<e.g. asi_dashboard_top = top of member dashboard;
         asi_sidebar = right rail on the portal home>>
- The platform API key is a SECRET. It must be read from a server-side env
  var named AD_ENGINE_KEY and NEVER shipped in client JS, committed, or put
  in a URL. If this stack renders purely client-side, proxy ad-engine calls
  through a small server route that injects the key.

WHAT TO BUILD
1. Add an <AdSlot /> React component (plus AdBanner / SponsoredCard /
   NativeAd presets). It must:
   - GET {BASE}/api/ads/serve?platform={slug}&placement={key}&userRole={role}
     with header  X-Ad-Engine-Key: {AD_ENGINE_KEY}
     (optional query: category, pageUrl). Response is { ad } or { ad: null }.
   - Render nothing when ad is null or the request fails (never break the
     host page — graceful empty fallback).
   - Record an impression only once the ad is >=50% visible
     (IntersectionObserver), POST {BASE}/api/ads/impression with JSON
     { adId, campaignId, creativeId, placementId, platform, anonymousUserId,
       userRole, pageUrl } and the X-Ad-Engine-Key header. Use
     navigator.sendBeacon when available.
   - On click: POST {BASE}/api/ads/click with
     { adId, campaignId, creativeId, placementId, platform, anonymousUserId },
     then open the returned destinationUrl in a new tab
     (rel="noopener noreferrer sponsored"). Do not trust/transform the URL
     yourself — the engine returns a sanitized destination.
   - Persist a stable anonymousUserId in localStorage (random uuid); send
     "server" when running without a window.
   - Show the disclosure label returned by the engine (ad.label) e.g.
     "Sponsored Local Partner" — keep it visible and non-spammy.
   The ad payload shape:
   { adId, campaignId, creativeId, placementId, platformId, creativeType,
     title, description, imageUrl, videoUrl, destinationUrl, ctaText,
     width, height, label }

2. Inject the key server-side. Add AD_ENGINE_KEY to env config and the
   deployment's secrets. If a server proxy is needed, expose
   GET /internal/ads/serve and POST /internal/ads/{impression,click} that
   forward to the engine with the header attached.

3. Place the slots at the placement locations listed above. Match the
   variant to the slot (banner for wide image areas, card for list/detail
   sidebars, native for inline content).

4. Add a short README section: which env var, which placements, how to test.

CONSTRAINTS
- Do not hardcode the API key or base URL in client bundles.
- Do not block page render on the ad request (load async, fail silent).
- Keep the component dependency-free (no ad SDKs); plain fetch + React.
- Match this repo's existing styling/component conventions.

ACCEPTANCE TEST
- With a valid key, the configured placements render a real ad, an
  impression is recorded after the ad scrolls into view, and clicking opens
  the advertiser URL.
- With the key removed or the engine unreachable, pages render normally
  with the ad areas simply absent.

A reference implementation of the component and client lives in the ad
engine repo under src/plugin/ (AdSlot.tsx, variants.tsx, client.ts) — port
it to this app's conventions rather than inventing a new protocol.
```

---

## Filling the placeholders

| Placeholder | Where to get it |
|---|---|
| Ad Engine base URL | Your deployed engine URL (`NEXT_PUBLIC_AD_ENGINE_URL`) |
| platform-slug | `/admin/platforms` — the slug you set when registering (e.g. `asicayman`, `cayrentmanager`, `clarityfinance`) |
| Placement keys | The placement keys you created on that platform's page |
| API key | Shown once when you register/regenerate the platform — store as `AD_ENGINE_KEY` secret in the target app |
