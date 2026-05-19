import "server-only";
import { cookies } from "next/headers";

const KEY_COOKIE = "cae_new_key";
// Short TTL: the raw key is revealed on the post-create/regenerate page and
// disappears on its own. We deliberately do NOT clear it during render —
// Next.js only allows cookie mutation in Server Actions / Route Handlers.
const TTL_SECONDS = 120;

/** Stash a freshly generated raw API key for a brief one-time reveal. */
export function stashKey(platformId: string, raw: string): void {
  cookies().set(`${KEY_COOKIE}_${platformId}`, raw, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

/** Read the stashed raw key (read-only; safe to call during render). */
export function readNewKey(platformId: string): string | null {
  return cookies().get(`${KEY_COOKIE}_${platformId}`)?.value ?? null;
}
