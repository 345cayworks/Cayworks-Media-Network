import "server-only";
import { env } from "cloudflare:workers";

/**
 * Cloudflare Workers implementation of {@link getEnv}, substituted for
 * `runtime-env.ts` by the resolve.alias in vite.config.ts.
 *
 * Worker secrets and vars are declared in cloudflare.config.ts and surface on
 * the `env` object from `cloudflare:workers`; `process.env` stays empty.
 */
export function getEnv(key: string): string | undefined {
  const value = (env as unknown as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}
