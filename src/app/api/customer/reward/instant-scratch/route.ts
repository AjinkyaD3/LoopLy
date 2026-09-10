import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { mobileNumber, businessId, name } = await request.json();

    if (!mobileNumber || !businessId) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const program = await tx.loyaltyProgram.findUnique({
        where: { businessId },
        include: { scratchCardPrizes: true },
      });

      if (!program || program.type !== "SCRATCH_CARD" || !program.isActive) {
        throw new Error("INVALID_PROGRAM");
      }

      if (program.scratchCardPrizes.length < 3 || program.scratchCardPrizes.length > 10) {
        throw new Error("INVALID_PRIZES");
      }

      // 1. Ensure Customer exists
      let customer = await tx.customer.findUnique({
        where: { businessId_mobileNumber: { businessId, mobileNumber } },
      });

      if (!customer) {
        customer = await tx.customer.create({
          data: { businessId, mobileNumber, name: name || null },
        });
      } else if (name && customer.name !== name) {
        // Opportunistic name update
        customer = await tx.customer.update({
          where: { id: customer.id },
          data: { name },
        });
      }

      // 2. Ensure Membership exists
      let membership = await tx.membership.findUnique({
        where: { customerId_businessId: { customerId: customer.id, businessId } },
      });

      if (!membership) {
        membership = await tx.membership.create({
          data: { customerId: customer.id, businessId },
        });
      }

      // 3. Perform weighted random selection
      const totalWeight = program.scratchCardPrizes.reduce((sum, p) => sum + p.weight, 0);
      let randomValue = Math.random() * totalWeight;
      let wonPrize = program.scratchCardPrizes[program.scratchCardPrizes.length - 1]; // default

      for (const prize of program.scratchCardPrizes) {
        randomValue -= prize.weight;
        if (randomValue <= 0) {
          wonPrize = prize;
          break;
        }
      }

      // 4. Create instantly redeemed Reward
      const now = new Date();
      const reward = await tx.reward.create({
        data: {
          membershipId: membership.id,
          businessId,
          customerId: customer.id,
          loyaltyProgramId: program.id,
          title: wonPrize.title,
          description: wonPrize.description || "",
          status: "REDEEMED", // Instant redeem for scratch cards
          type: "SCRATCH_CARD",
          scratchCardPrizeId: wonPrize.id,
          revealedPrize: wonPrize.title,
          expiresAt: new Date(now.getTime() + program.rewardValidityDays * 24 * 60 * 60 * 1000),
          redeemedAt: now,
        },
      });

      return reward;
    });

    return NextResponse.json({ success: true, reward: result }, { status: 200 });

  } catch (error: any) {
    if (error.message === "INVALID_PROGRAM") {
      return NextResponse.json({ error: "Active Scratch Card program not found." }, { status: 404 });
    }
    if (error.message === "INVALID_PRIZES") {
      return NextResponse.json({ error: "Program is misconfigured. Contact the business owner." }, { status: 500 });
    }
    console.error("Instant scratch error:", error);
    return NextResponse.json({ error: "Failed to process scratch card." }, { status: 500 });
  }
}
