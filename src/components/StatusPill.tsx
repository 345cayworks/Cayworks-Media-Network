import {
  effectiveStatus,
  statusPillClasses,
  statusLabel,
  type CampaignForStatus,
} from "@/lib/campaign-status";

/**
 * Single-source-of-truth pill that collapses a campaign's combined state
 * (campaign.status × link statuses × dates × billing × creative presence)
 * into one badge with a tooltip listing every reason.
 */
export function StatusPill({ campaign }: { campaign: CampaignForStatus }) {
  const { status, reasons } = effectiveStatus(campaign);
  return (
    <span
      title={reasons.join(" · ")}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${statusPillClasses(status)}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabel(status)}
    </span>
  );
}
