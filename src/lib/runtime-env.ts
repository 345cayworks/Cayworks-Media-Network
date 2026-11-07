import "server-only";

/**
 * Reads a server-side environment value.
 *
 * This is the Node implementation, used by `next build` / `next dev` and so by
 * the Netlify deploy. The Cloudflare Workers build is pointed at
 * `runtime-env.cloudflare.ts` instead, via a resolve.alias in vite.config.ts,
 * because Workers do not populate `process.env` from Worker secrets — those
 * arrive on the `env` object exported by `cloudflare:workers`.
 *
 * Always read server config through this helper rather than touching
 * `process.env` directly, or the value will silently be undefined on Workers.
 */
export function getEnv(key: string): string | undefined {
  return process.env[key];
}
