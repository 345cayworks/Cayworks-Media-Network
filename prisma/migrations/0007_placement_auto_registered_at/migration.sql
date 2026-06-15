-- Mark placements that were auto-created on first /api/ads/serve hit
-- with an unknown placementKey. Such rows land in INACTIVE for review.
ALTER TABLE "AdPlacement" ADD COLUMN "autoRegisteredAt" TIMESTAMP(3);
