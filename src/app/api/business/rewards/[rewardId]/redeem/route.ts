import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/business/rewards/[rewardId]/redeem
 * Marks an AVAILABLE, non-expired reward as REDEEMED.
 *
 * Security:
 *   - Owner's business resolved via ownerId === user.id.
 *   - reward.businessId must match ownedBusiness.id.
 *   - Conditional update (status = AVAILABLE and expiresAt > now) prevents:
 *     - Double redemption
 *     - Expired reward redemption
 *     - Race condition double-redeem
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ rewardId: string }> }
) {
  try {
    const user = await requireBusinessOwner();
    const { rewardId } = await params;

    if (!rewardId) {
      return NextResponse.json({ error: "Reward ID is required." }, { status: 400 });
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

    if (!reward || reward.businessId !== business.id) {
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
      // Another concurrent request won the race
      return NextResponse.json(
        { error: "Reward could not be redeemed — it may have already been processed." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Reward successfully redeemed!",
      redeemedAt: now,
    });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN_NOT_BUSINESS_OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Redeem reward error:", err);
    return NextResponse.json({ error: "Failed to redeem reward." }, { status: 500 });
  }
}
