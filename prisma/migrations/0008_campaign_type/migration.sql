-- Campaign auto-publish gate: a campaign's type, matched against
-- AdPlacement.placementType to auto-assign placements on activation.
-- A strict subset of PlacementType (BANNER / CARD / NATIVE).
CREATE TYPE "CampaignType" AS ENUM ('BANNER', 'CARD', 'NATIVE');

-- Existing campaigns backfill to BANNER; operators can change per campaign.
ALTER TABLE "Campaign" ADD COLUMN "campaignType" "CampaignType" NOT NULL DEFAULT 'BANNER';
