export type CampaignStatus = "SCHEDULED" | "ACTIVE" | "ENDED";

/**
 * Derives a campaign's status from its dates/flags and prize stock — never stored, always
 * computed fresh, so there is nothing to keep in sync via a cron job.
 * Shared by both the public play route/page and the owner dashboard list so status logic can
 * never diverge between the two surfaces.
 */
export function getCampaignStatus(
  campaign: { startsAt: Date; endsAt: Date | null; endedManuallyAt: Date | null },
  prizes: { remainingStock: number }[]
): CampaignStatus {
  const now = new Date();

  if (now < campaign.startsAt) {
    return "SCHEDULED";
  }

  const allOutOfStock = prizes.length > 0 && prizes.every((p) => p.remainingStock <= 0);
  if (campaign.endedManuallyAt || (campaign.endsAt && now > campaign.endsAt) || allOutOfStock) {
    return "ENDED";
  }

  return "ACTIVE";
}
