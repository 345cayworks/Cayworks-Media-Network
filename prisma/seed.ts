import { PrismaClient } from "@prisma/client";
import { runSeed } from "../src/lib/seed-core";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL ?? "admin@cayworks.example";
  const password = process.env.SUPERADMIN_MASTER_KEY ?? "ChangeMe123!";

  const result = await runSeed(prisma, { email, password });

  for (const line of result.log) console.log(`✓ ${line}`);
  for (const [slug, key] of Object.entries(result.newPlatformKeys)) {
    console.log(`\n  ${slug} API KEY (save this — shown once): ${key}`);
  }
  console.log(
    `\nSuperadmin ready: ${result.superadminEmail} (password = SUPERADMIN_MASTER_KEY)`,
  );
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
