import "server-only";
import { cookies } from "next/headers";

const KEY_COOKIE = "cae_new_key";

/** Stash a freshly generated raw API key for a one-time reveal. */
export function stashKey(platformId: string, raw: string): void {
  cookies().set(`${KEY_COOKIE}_${platformId}`, raw, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 120,
  });
}

/** Read the stashed raw key once, then immediately clear it. */
export function readAndClearNewKey(platformId: string): string | null {
  const c = cookies();
  const name = `${KEY_COOKIE}_${platformId}`;
  const val = c.get(name)?.value ?? null;
  if (val) c.set(name, "", { path: "/", maxAge: 0 });
  return val;
}
