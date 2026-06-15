import type { Campaign } from "@prisma/client";

export type EffectiveStatus =
  | "LIVE"
  | "PAUSED"
  | "DRAFT"
  | "ENDED"
  | "OFF_SCHEDULE"
  | "NO_CREATIVES"
  | "NO_PLACEMENTS"
  | "ADVERTISER_OFF";

export type EffectiveStatusResult = {
  status: EffectiveStatus;
  reasons: string[];
};

export type CampaignForStatus = Pick<
  Campaign,
  "status" | "startDate" | "endDate"
> & {
  advertiser?: { status: string; billingStatus: string } | null;
  creativeLinks: { status: string }[];
  campaignPlacements: { status: string }[];
};

/**
 * Distill a campaign's combined state — campaign.status, link statuses,
 * approval / dates / billing — into one badge value with human-readable
 * reasons for the tooltip. Selection is the source of truth; this mirrors
 * its checks so the badge can't drift.
 */
export function effectiveStatus(c: CampaignForStatus): EffectiveStatusResult {
  const reasons: string[] = [];
  const now = new Date();

  if (c.status === "ENDED") return { status: "ENDED", reasons: ["Campaign ended"] };
  if (c.status === "DRAFT") return { status: "DRAFT", reasons: ["Campaign is a draft"] };

  if (c.advertiser && c.advertiser.status !== "ACTIVE") {
    return {
      status: "ADVERTISER_OFF",
      reasons: [`Advertiser is ${c.advertiser.status}`],
    };
  }
  if (c.advertiser?.billingStatus === "ON_HOLD") {
    return { status: "ADVERTISER_OFF", reasons: ["Billing on hold"] };
  }

  if (c.status === "PAUSED") return { status: "PAUSED", reasons: ["Campaign paused"] };

  if (c.startDate > now) reasons.push("Hasn't started yet");
  if (c.endDate < now) reasons.push("Past end date");
  if (reasons.length > 0) return { status: "OFF_SCHEDULE", reasons };

  const hasActiveCreative = c.creativeLinks.some((l) => l.status === "ACTIVE");
  if (!hasActiveCreative) {
    return { status: "NO_CREATIVES", reasons: ["No active creative attached"] };
  }
  const hasActivePlacement = c.campaignPlacements.some(
    (p) => p.status === "ACTIVE",
  );
  if (!hasActivePlacement) {
    return { status: "NO_PLACEMENTS", reasons: ["No active placement assigned"] };
  }

  return { status: "LIVE", reasons: ["Serving"] };
}

const TONE: Record<EffectiveStatus, string> = {
  LIVE: "bg-emerald-100 text-emerald-700",
  PAUSED: "bg-amber-100 text-amber-700",
  DRAFT: "bg-slate-100 text-slate-600",
  ENDED: "bg-slate-100 text-slate-500",
  OFF_SCHEDULE: "bg-rose-100 text-rose-700",
  NO_CREATIVES: "bg-rose-100 text-rose-700",
  NO_PLACEMENTS: "bg-rose-100 text-rose-700",
  ADVERTISER_OFF: "bg-rose-100 text-rose-700",
};

const LABEL: Record<EffectiveStatus, string> = {
  LIVE: "Live",
  PAUSED: "Paused",
  DRAFT: "Draft",
  ENDED: "Ended",
  OFF_SCHEDULE: "Off schedule",
  NO_CREATIVES: "No creatives",
  NO_PLACEMENTS: "No placements",
  ADVERTISER_OFF: "Advertiser off",
};

export function statusPillClasses(s: EffectiveStatus): string {
  return TONE[s];
}
export function statusLabel(s: EffectiveStatus): string {
  return LABEL[s];
}
