import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== UserRole.CUSTOMER) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Reward ID is required." }, { status: 400 });
    }

    // 1. Fetch reward to verify ownership and type
    const reward = await prisma.reward.findUnique({
      where: { id },
    });

    if (!reward) {
      return NextResponse.json({ error: "Reward not found." }, { status: 404 });
    }

    if (reward.customerId !== user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    if (reward.type !== "SCRATCH_CARD") {
      return NextResponse.json({ error: "This reward is not a scratch card." }, { status: 400 });
    }

    if (reward.isScratched) {
      return NextResponse.json({ error: "Reward has already been scratched." }, { status: 409 });
    }

    // 2. Mark scratched and log the event (we just update the reward for now)
    const updatedReward = await prisma.reward.update({
      where: { id },
      data: { isScratched: true },
    });

    // Note: Logging every scratch reveal for future tuning can be done here.
    console.log(`[SCRATCH_REVEAL] RewardID: ${id} | Prize: ${updatedReward.revealedPrize} | Time: ${new Date().toISOString()}`);

    return NextResponse.json({
      success: true,
      revealedPrize: updatedReward.revealedPrize,
    });
  } catch (error) {
    console.error("Scratch reward error:", error);
    return NextResponse.json(
      { error: "Failed to scratch reward." },
      { status: 500 }
    );
  }
}
