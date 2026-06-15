-- Track the last time a host pushed its placement manifest via
-- POST /api/platforms/sync-placements.
ALTER TABLE "Platform" ADD COLUMN "lastSyncedAt" TIMESTAMP(3);
