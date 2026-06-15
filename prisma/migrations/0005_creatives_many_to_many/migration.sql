-- Many-to-many creatives: introduce CampaignCreative join, backfill from
-- the existing Creative.campaignId, then drop the column.

CREATE TYPE "CampaignCreativeStatus" AS ENUM ('ACTIVE', 'PAUSED');

CREATE TABLE "CampaignCreative" (
  "id"         TEXT PRIMARY KEY,
  "campaignId" TEXT NOT NULL,
  "creativeId" TEXT NOT NULL,
  "status"     "CampaignCreativeStatus" NOT NULL DEFAULT 'ACTIVE',
  "weight"     INTEGER NOT NULL DEFAULT 1,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "CampaignCreative_campaignId_creativeId_key"
  ON "CampaignCreative" ("campaignId", "creativeId");
CREATE INDEX "CampaignCreative_campaignId_idx" ON "CampaignCreative" ("campaignId");
CREATE INDEX "CampaignCreative_creativeId_idx" ON "CampaignCreative" ("creativeId");

ALTER TABLE "CampaignCreative"
  ADD CONSTRAINT "CampaignCreative_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CampaignCreative_creativeId_fkey"
    FOREIGN KEY ("creativeId") REFERENCES "Creative" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one link per existing creative, into its current campaign.
INSERT INTO "CampaignCreative" ("id", "campaignId", "creativeId", "status", "weight", "createdAt", "updatedAt")
SELECT
  'cclink_' || "id" AS id,
  "campaignId",
  "id" AS creativeId,
  'ACTIVE'::"CampaignCreativeStatus",
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Creative";

-- Drop the now-redundant column + its FK.
ALTER TABLE "Creative" DROP CONSTRAINT IF EXISTS "Creative_campaignId_fkey";
ALTER TABLE "Creative" DROP COLUMN "campaignId";
