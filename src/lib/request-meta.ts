import { createHash } from "crypto";
import type { DeviceType } from "@prisma/client";

export function detectDevice(userAgent: string | null): DeviceType {
  const ua = (userAgent ?? "").toLowerCase();
  if (!ua) return "UNKNOWN";
  if (/ipad|tablet|playbook|silk/.test(ua)) return "TABLET";
  if (/mobi|iphone|android.*mobile|phone/.test(ua)) return "MOBILE";
  if (/android|iphone|ipod/.test(ua)) return "MOBILE";
  return "DESKTOP";
}

/** One-way hash of the client IP so raw addresses are never persisted. */
export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const salt = process.env.AUTH_SECRET ?? "cae";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export function clientIp(headers: Headers): string | null {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? null;
  return headers.get("x-real-ip") ?? null;
}
