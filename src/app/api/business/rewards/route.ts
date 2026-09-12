import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/business/rewards
 * Returns all AVAILABLE rewards for the owner's business (for redemption display).
 */
export async function GET() {
  try {
    const user = await requireBusinessOwner();

    const business = await prisma.business.findUnique({
      where: { ownerId: user.id },
    });

    if (!business) {
      return NextResponse.json({ error: "No business found for this owner." }, { status: 404 });
    }

    const now = new Date();
    const rewards = await prisma.reward.findMany({
      where: {
        businessId: business.id,
        status: "AVAILABLE",
        expiresAt: { gt: now },
      },
      include: {
        customer: { select: { name: true, mobileNumber: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const campaignPlays = await prisma.campaignPlay.findMany({
      where: {
        campaign: { businessId: business.id },
        status: "AVAILABLE",
        claimCode: { not: null },
      },
      include: {
        campaign: { select: { name: true } },
      },
      orderBy: { playedAt: "desc" },
    });

    // Map CampaignPlays to match the structure expected by the UI
    const mappedPlays = campaignPlays.map(play => ({
      id: play.id,
      title: `Campaign: ${play.campaign.name}`,
      description: `Prize: ${play.revealedPrize}`,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(), // Dummy 30 days
      createdAt: play.playedAt.toISOString(),
      customer: { name: play.customerName || "Guest", mobileNumber: play.mobileNumber },
      type: "CAMPAIGN",
    }));

    const mappedRewards = rewards.map(r => ({ ...r, type: "LOYALTY" }));

    const combined = [...mappedRewards, ...mappedPlays].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ rewards: combined });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN_NOT_BUSINESS_OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Fetch business rewards error:", err);
    return NextResponse.json({ error: "Failed to fetch rewards." }, { status: 500 });
  }
}
