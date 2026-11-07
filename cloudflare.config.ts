import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  // Info@cayworks.com's Account. Not a secret; keeps deploys deterministic in CI.
  accountId: "bc26de2ac00c37461d2d9fe80e29f6ef",
  worker: defineWorker({
    // Must match the Worker that the repo's Workers Builds integration
    // targets, which is "cayworks-media-network" (not the package name).
    name: "cayworks-media-network",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-07",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      // Set these with `npx cf secret put <NAME>` (or wrangler secret put)
      // before the first deploy; locally they come from .dev.vars.
      DATABASE_URL: bindings.secret(),
      AUTH_SECRET: bindings.secret(),
      // Optional - only needed if you use the /api/bootstrap endpoint:
      // SUPERADMIN_MASTER_KEY: bindings.secret(),
      // SUPER_ADMIN_EMAIL: bindings.secret(),
    },
  }),
});
