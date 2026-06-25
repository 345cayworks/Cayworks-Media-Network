-- Multi-format campaigns: a creative declares its slot format, matched to
-- AdPlacement.placementType at serve time. Replaces the single Campaign-level
-- campaignType gate (dropped below).

-- 1. New CreativeFormat enum (mirrors PlacementType).
CREATE TYPE "CreativeFormat" AS ENUM ('BANNER', 'SIDEBAR', 'CARD', 'NATIVE', 'VIDEO', 'SKYSCRAPER');

-- 2. Creative.format, defaulting to BANNER for existing rows.
ALTER TABLE "Creative" ADD COLUMN "format" "CreativeFormat" NOT NULL DEFAULT 'BANNER';

-- 3. Backfill format from the media kind where it's unambiguous. IMAGE/HTML
--    stay BANNER (admins retag CARD / SIDEBAR / SKYSCRAPER by dimensions).
UPDATE "Creative" SET "format" = 'NATIVE' WHERE "creativeType" = 'NATIVE';
UPDATE "Creative" SET "format" = 'VIDEO'  WHERE "creativeType" = 'VIDEO';

-- 4. Drop the retired campaign-level type gate.
ALTER TABLE "Campaign" DROP COLUMN "campaignType";
DROP TYPE "CampaignType";
