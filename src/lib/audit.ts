import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";

/**
 * Append-only audit log for major admin actions. Failures here must never
 * break the underlying operation, so errors are swallowed after logging.
 */
export async function audit(
  actor: SessionUser | null,
  action: string,
  entity: string,
  entityId?: string | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: actor?.id ?? null,
        actorEmail: actor?.email ?? "system",
        action,
        entity,
        entityId: entityId ?? null,
        metadata: metadata ? (metadata as object) : undefined,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write log entry", err);
  }
}
