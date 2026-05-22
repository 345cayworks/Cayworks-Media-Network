export type AdPayload = {
  adId: string;
  campaignId: string;
  creativeId: string;
  placementId: string;
  platformId: string;
  creativeType: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  destinationUrl: string;
  ctaText: string | null;
  width: number | null;
  height: number | null;
  label: string;
};

export type ResolvedVideo =
  | { type: "youtube"; embedSrc: string }
  | { type: "file"; src: string };

export function resolveVideo(
  videoUrl: string | null | undefined,
): ResolvedVideo | null {
  if (!videoUrl) return null;
  try {
    const u = new URL(videoUrl.trim());
    const host = u.hostname.replace(/^www\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1) || null;
    else if (host.endsWith("youtube.com")) {
      if (u.pathname === "/watch") id = u.searchParams.get("v");
      else {
        const m = u.pathname.match(/^\/(embed|shorts|v)\/([^/?]+)/);
        if (m) id = m[2] ?? null;
      }
    }
    if (id) {
      return {
        type: "youtube",
        embedSrc: `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`,
      };
    }
    if (u.protocol === "http:" || u.protocol === "https:") {
      return { type: "file", src: u.toString() };
    }
  } catch {
    return null;
  }
  return null;
}

export type AdEngineConfig = {
  engineUrl: string;
  apiKey: string;
  platform: string;
};

const ANON_KEY = "cae_anon_id";

export function anonymousUserId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let id = window.localStorage.getItem(ANON_KEY);
    if (!id) {
      id =
        (crypto.randomUUID && crypto.randomUUID()) ||
        `anon_${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return "anon_unknown";
  }
}

export async function fetchAd(
  cfg: AdEngineConfig,
  params: {
    placement: string;
    userRole?: string;
    category?: string;
    pageUrl?: string;
  },
): Promise<AdPayload | null> {
  const url = new URL("/api/ads/serve", cfg.engineUrl);
  url.searchParams.set("platform", cfg.platform);
  url.searchParams.set("placement", params.placement);
  if (params.userRole) url.searchParams.set("userRole", params.userRole);
  if (params.category) url.searchParams.set("category", params.category);
  if (params.pageUrl) url.searchParams.set("pageUrl", params.pageUrl);

  try {
    const res = await fetch(url.toString(), {
      headers: { "X-Ad-Engine-Key": cfg.apiKey },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { ad: AdPayload | null };
    return json.ad ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch a weighted rotation queue of up to `count` ads for a placement.
 * Heavier-weight campaigns appear proportionally more often in the order.
 */
export async function fetchAdQueue(
  cfg: AdEngineConfig,
  params: {
    placement: string;
    userRole?: string;
    category?: string;
    pageUrl?: string;
  },
  count: number,
): Promise<AdPayload[]> {
  const url = new URL("/api/ads/serve", cfg.engineUrl);
  url.searchParams.set("platform", cfg.platform);
  url.searchParams.set("placement", params.placement);
  url.searchParams.set("count", String(count));
  if (params.userRole) url.searchParams.set("userRole", params.userRole);
  if (params.category) url.searchParams.set("category", params.category);
  if (params.pageUrl) url.searchParams.set("pageUrl", params.pageUrl);

  try {
    const res = await fetch(url.toString(), {
      headers: { "X-Ad-Engine-Key": cfg.apiKey },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { ads?: AdPayload[] };
    return json.ads ?? [];
  } catch {
    return [];
  }
}

export function recordImpression(
  cfg: AdEngineConfig,
  ad: AdPayload,
  ctx: { userRole?: string; pageUrl?: string },
): void {
  const url = new URL("/api/ads/impression", cfg.engineUrl);
  const body = JSON.stringify({
    adId: ad.adId,
    campaignId: ad.campaignId,
    creativeId: ad.creativeId,
    placementId: ad.placementId,
    platform: cfg.platform,
    anonymousUserId: anonymousUserId(),
    userRole: ctx.userRole,
    pageUrl: ctx.pageUrl ?? (typeof window !== "undefined" ? window.location.href : undefined),
  });
  // sendBeacon survives page navigation; fall back to fetch.
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon(url.toString(), new Blob([body], { type: "application/json" }));
    return;
  }
  void fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Ad-Engine-Key": cfg.apiKey },
    body,
    keepalive: true,
  });
}

export async function recordClick(
  cfg: AdEngineConfig,
  ad: AdPayload,
): Promise<string> {
  const url = new URL("/api/ads/click", cfg.engineUrl);
  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Ad-Engine-Key": cfg.apiKey,
      },
      body: JSON.stringify({
        adId: ad.adId,
        campaignId: ad.campaignId,
        creativeId: ad.creativeId,
        placementId: ad.placementId,
        platform: cfg.platform,
        anonymousUserId: anonymousUserId(),
      }),
    });
    const json = (await res.json()) as { destinationUrl?: string };
    return json.destinationUrl ?? ad.destinationUrl;
  } catch {
    return ad.destinationUrl;
  }
}
