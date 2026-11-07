import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { getEnv } from "@/lib/runtime-env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createClient(): PrismaClient {
  const connectionString = getEnv("DATABASE_URL");
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is missing. Set it in .env locally, or as a Worker secret / Netlify env var.",
    );
  }

  // The Neon serverless driver works on both the Node runtime (Netlify) and
  // Cloudflare Workers, so a single adapter covers both deploy targets.
  const adapter = new PrismaNeon({ connectionString });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}

// Lazy proxy: the client — and its DATABASE_URL read — is created on first
// use rather than at module evaluation. Cloudflare Workers do not expose
// bindings while modules are still being evaluated, so constructing the
// adapter eagerly would throw there. Reusing one client per isolate also
// keeps connection churn down between requests.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
