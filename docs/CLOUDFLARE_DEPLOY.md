# Deploying to Cloudflare Workers

The app has two deploy targets from one codebase:

| Target | Build | Runtime |
| --- | --- | --- |
| Netlify (current production) | `npm run build` (`next build`) | Node, via `@netlify/plugin-nextjs` |
| Cloudflare Workers | `npm run build:vinext` (`vite build`) | workerd, via [vinext](https://github.com/cloudflare/vinext) |

Netlify is unaffected by the Cloudflare setup: `next build`, `netlify.toml` and
the `main` branch behave exactly as before.

## Prerequisites

- Node 20.9+ (`engines.node`).
- A Cloudflare account. `npx cf auth login`, or `CLOUDFLARE_API_TOKEN` in CI.
  The account id is already set in `cloudflare.config.ts`.
- A Postgres database reachable over the Neon serverless driver.

## Environment variables

Workers do **not** populate `process.env` from Worker secrets. Secrets arrive on
the `env` object exported by `cloudflare:workers` instead.

Server code must therefore never read `process.env` directly. Use:

```ts
import { getEnv } from "@/lib/runtime-env";

const url = getEnv("DATABASE_URL");
```

`src/lib/runtime-env.ts` is the Node implementation used by `next build`, and
`vite.config.ts` aliases that import to `src/lib/runtime-env.cloudflare.ts` for
the Workers build. Reading `process.env` directly works on Netlify and silently
yields `undefined` on Workers — which is the bug this indirection exists to
prevent.

Each variable must also be declared in `cloudflare.config.ts` under
`worker.env`, as `bindings.secret()` for secrets or `bindings.text(value)` for
non-sensitive values. `vars` is not a valid key there.

### Local

Copy `.dev.vars.example` to `.dev.vars`. It is loaded by `npm run dev:vinext`.

`npm run start:vinext` (vite preview) does **not** load `.dev.vars`, so
`/api/health` will report the variables as unset under preview. Use
`dev:vinext` to exercise anything that needs the database.

### Production

```bash
npx cf secret put DATABASE_URL
npx cf secret put AUTH_SECRET
```

Add `SUPERADMIN_MASTER_KEY` and `SUPER_ADMIN_EMAIL` the same way if you intend
to use `/api/bootstrap`, and uncomment them in `cloudflare.config.ts`.

## Commands

```bash
npm run dev:vinext      # dev server on :3001 (workerd, loads .dev.vars)
npm run build:vinext    # prisma generate && vite build -> .cloudflare/output
npm run start:vinext    # preview the built Worker on :4173
npm run deploy:vinext   # deploy
```

## Database

Prisma cannot run its standard query engine on Workers, so the client goes
through the Neon driver adapter (`src/lib/prisma.ts`). The Neon serverless
driver also runs on Node, so Netlify and Workers share one code path.

The client is created lazily behind a `Proxy` on first use. Workers do not
expose bindings while modules are still being evaluated, so constructing the
adapter at module scope would throw.

Migrations are unchanged: `npm run db:migrate:deploy`.

## Known caveats

- vinext is beta, and it pulls in `@cloudflare/vite-plugin@2.0.0-beta` and
  `cf@1.0.0-beta`. Pin upgrades deliberately.
- `postbuild` runs `prisma generate && tsx prisma/seed.ts`, which fails
  harmlessly when the database is unreachable at build time.
- Switching between `next build` and `vite build` can leave stale route types
  in `.next/types`. `npm run typecheck` runs `next typegen` first to avoid it.
- The Neon adapter uses a WebSocket pool. One client is reused per isolate; if
  you see dropped connections under load, move to per-request client creation
  or put Cloudflare Hyperdrive in front of Postgres.
