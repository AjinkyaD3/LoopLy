import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/business/rewards/[rewardId]/redeem
 * Marks an AVAILABLE, non-expired reward as REDEEMED after verifying the claim code.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { rewardId: string } }
) {
  try {
    const user = await requireBusinessOwner();
    const { rewardId } = params;

    if (!rewardId) {
      return NextResponse.json({ error: "Reward ID is required." }, { status: 400 });
    }

    let claimCode = "";
    try {
      const body = await request.json();
      claimCode = body.claimCode || "";
    } catch {
      // Body might be empty
    }

    if (!claimCode) {
      return NextResponse.json({ error: "Claim code is required." }, { status: 400 });
    }

    // Resolve owner's business
    const business = await prisma.business.findUnique({
      where: { ownerId: user.id },
    });

    if (!business) {
      return NextResponse.json({ error: "No business found for this owner." }, { status: 404 });
    }

    // Fetch reward and verify it belongs to this business
    const reward = await prisma.reward.findUnique({ where: { id: rewardId } });

    if (reward) {
      if (reward.businessId !== business.id) {
        return NextResponse.json({ error: "Reward not found." }, { status: 404 });
      }

      if (reward.status === "REDEEMED") {
        return NextResponse.json({ error: "This reward has already been redeemed." }, { status: 409 });
      }

      const now = new Date();
      if (reward.expiresAt <= now) {
        return NextResponse.json({ error: "This reward has expired and cannot be redeemed." }, { status: 409 });
      }

      if (reward.status !== "AVAILABLE") {
        return NextResponse.json({ error: "This reward is not available for redemption." }, { status: 409 });
      }

      if (!reward.claimCode || reward.claimCode.toUpperCase() !== claimCode.toUpperCase()) {
        return NextResponse.json({ error: "Invalid claim code. Please ask the customer for the correct code." }, { status: 400 });
      }

      // Atomic conditional update — prevents race-condition double-redeem
      const updated = await prisma.reward.updateMany({
        where: {
          id: rewardId,
          status: "AVAILABLE",
          expiresAt: { gt: now },
          businessId: business.id,
        },
        data: {
          status: "REDEEMED",
          redeemedAt: now,
          redeemedByUserId: user.id,
        },
      });

      if (updated.count === 0) {
        return NextResponse.json({ error: "Reward could not be redeemed — it may have already been processed." }, { status: 409 });
      }

      return NextResponse.json({
        success: true,
        message: "Reward successfully redeemed!",
        redeemedAt: now,
      });
    }

    // Fallback to CampaignPlay
    const campaignPlay = await prisma.campaignPlay.findUnique({
      where: { id: rewardId },
      include: { campaign: true },
    });

    if (campaignPlay) {
      if (campaignPlay.campaign.businessId !== business.id) {
        return NextResponse.json({ error: "Campaign Prize not found." }, { status: 404 });
      }

      if (campaignPlay.status === "REDEEMED") {
        return NextResponse.json({ error: "This campaign prize has already been redeemed." }, { status: 409 });
      }

      if (campaignPlay.status !== "AVAILABLE") {
        return NextResponse.json({ error: "This campaign prize is not available for redemption." }, { status: 409 });
      }

      if (!campaignPlay.claimCode || campaignPlay.claimCode.toUpperCase() !== claimCode.toUpperCase()) {
        return NextResponse.json({ error: "Invalid claim code. Please ask the customer for the correct code." }, { status: 400 });
      }

      const now = new Date();
      const updated = await prisma.campaignPlay.updateMany({
        where: {
          id: rewardId,
          status: "AVAILABLE",
        },
        data: {
          status: "REDEEMED",
          redeemedAt: now,
          redeemedByUserId: user.id,
        },
      });

      if (updated.count === 0) {
        return NextResponse.json({ error: "Campaign Prize could not be redeemed — it may have already been processed." }, { status: 409 });
      }

      return NextResponse.json({
        success: true,
        message: "Campaign Prize successfully redeemed!",
        redeemedAt: now,
      });
    }

    return NextResponse.json({ error: "Reward not found." }, { status: 404 });


  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN_NOT_BUSINESS_OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Redeem reward error:", err);
    return NextResponse.json({ error: "Failed to redeem reward." }, { status: 500 });
  }
}
