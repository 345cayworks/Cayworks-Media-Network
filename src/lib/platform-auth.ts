import type { Platform } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { apiKeyMatches } from "@/lib/api-key";

export type PlatformAuthResult =
  | { ok: true; platform: Platform }
  | { ok: false; status: number; error: string };

function extractKey(req: Request, url: URL): string | null {
  const header = req.headers.get("x-ad-engine-key");
  if (header) return header;
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return url.searchParams.get("apiKey");
}

function hostFromHeader(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return value.toLowerCase().replace(/^https?:\/\//, "").split("/")[0] ?? null;
  }
}

/**
 * Authenticate a partner platform request via its API key + the `platform`
 * slug. Optionally enforces the platform's allowed-domains list against the
 * request Origin/Referer.
 */
export async function authenticatePlatform(
  req: Request,
  slug: string | null,
): Promise<PlatformAuthResult> {
  const url = new URL(req.url);
  if (!slug) {
    return { ok: false, status: 400, error: "Missing platform slug" };
  }
  const key = extractKey(req, url);
  if (!key) {
    return { ok: false, status: 401, error: "Missing API key" };
  }

  const platform = await prisma.platform.findUnique({
    where: { slug: slug.toLowerCase().trim() },
  });
  if (!platform || platform.status !== "ACTIVE") {
    return { ok: false, status: 403, error: "Unknown or inactive platform" };
  }
  if (!apiKeyMatches(key, platform.apiKeyHash)) {
    return { ok: false, status: 401, error: "Invalid API key" };
  }

  if (platform.allowedDomains.length > 0) {
    const origin =
      hostFromHeader(req.headers.get("origin")) ??
      hostFromHeader(req.headers.get("referer"));
    // Server-to-server calls (no Origin/Referer) are allowed; browser calls
    // must originate from a whitelisted domain.
    if (origin) {
      const allowed = platform.allowedDomains.some((d) => {
        const dom = d.toLowerCase().trim();
        return origin === dom || origin.endsWith(`.${dom}`);
      });
      if (!allowed) {
        return { ok: false, status: 403, error: "Domain not allowed" };
      }
    }
  }

  return { ok: true, platform };
}
