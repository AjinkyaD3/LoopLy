import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { mobileNumber, businessId, claimCode } = await request.json();

    if (!mobileNumber || !businessId || !claimCode) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const reward = await prisma.reward.findFirst({
      where: { 
        businessId,
        customer: { mobileNumber },
        status: "AVAILABLE",
        claimCode
      },
    });

    if (!reward) {
      return NextResponse.json({ error: "Invalid code or no available reward found" }, { status: 404 });
    }

    // Mark as redeemed
    const updatedReward = await prisma.reward.update({
      where: { id: reward.id },
      data: {
        status: "REDEEMED",
        redeemedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, reward: updatedReward }, { status: 200 });

  } catch (error) {
    console.error("Claim code error:", error);
    return NextResponse.json({ error: "Failed to claim reward" }, { status: 500 });
  }
}
