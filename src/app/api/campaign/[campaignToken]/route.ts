import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isValidToken } from "@/lib/token";
import { getCampaignStatus } from "@/lib/campaign";

export const dynamic = "force-dynamic";

/**
 * GET /api/campaign/[campaignToken]
 * Public, unauthenticated lookup for the campaign play page — mirrors
 * /api/public/business/[businessToken]. Returns only a sanitized projection.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { campaignToken: string } }
) {
  try {
    const { campaignToken } = params;

    if (!campaignToken || !isValidToken(campaignToken)) {
      return NextResponse.json({ error: "Invalid campaign token format." }, { status: 404 });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { campaignToken },
      include: { prizes: true, business: { select: { name: true } } },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }

    const status = getCampaignStatus(campaign, campaign.prizes);

    return NextResponse.json({
      name: campaign.name,
      businessName: campaign.business.name,
      status,
      startsAt: campaign.startsAt,
    });
  } catch (error) {
    console.error("Public campaign lookup error:", error);
    return NextResponse.json({ error: "Failed to resolve campaign." }, { status: 500 });
  }
}
