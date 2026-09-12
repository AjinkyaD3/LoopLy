import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessOwner } from "@/lib/auth";
import { VerificationReviewSchema } from "@/lib/validations";

function generateClaimCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const user = await requireBusinessOwner();
    const { requestId } = params;

    if (!requestId) {
      return NextResponse.json({ error: "Request ID is required." }, { status: 400 });
    }

    const body = await request.json();
    const parsed = VerificationReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input." }, { status: 400 });
    }

    const { status: decision, rejectionReason } = parsed.data;

    const business = await prisma.business.findUnique({ where: { ownerId: user.id } });

    if (!business) {
      return NextResponse.json({ error: "No business found for this owner." }, { status: 404 });
    }

    if (decision === "REJECTED") {
      const vr = await prisma.visitRequest.findUnique({ where: { id: requestId } });
      if (!vr) return NextResponse.json({ error: "Verification request not found." }, { status: 404 });
      if (vr.businessId !== business.id) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
      if (vr.status !== "PENDING") {
        return NextResponse.json({ error: "Only PENDING requests can be reviewed." }, { status: 409 });
      }

      const updated = await prisma.visitRequest.update({
        where: { id: requestId },
        data: { status: "REJECTED", reviewedAt: new Date(), rejectionReason: rejectionReason ?? null },
      });

      return NextResponse.json({ success: true, request: updated });
    }

    const result = await prisma.$transaction(async (tx) => {
      const vr = await tx.visitRequest.findUnique({
        where: { id: requestId },
        include: { membership: true, loyaltyProgram: { include: { rewardDefinitions: true } } },
      });

      if (!vr) throw new Error("NOT_FOUND");
      if (vr.businessId !== business.id) throw new Error("FORBIDDEN");
      if (vr.status !== "PENDING") throw new Error("ALREADY_PROCESSED");

      const now = new Date();
      let program = vr.loyaltyProgram;

      if (!program) {
        program = await tx.loyaltyProgram.findFirst({
          where: {
            businessId: business.id,
            startsAt: { lte: now },
            endsAt: { gte: now },
            endedManuallyAt: null,
          },
          orderBy: { startsAt: "desc" },
          include: { rewardDefinitions: true }
        });
      }

      if (!program) throw new Error("PROGRAM_NOT_FOUND");

      await tx.visitRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED", reviewedAt: now },
      });

      await tx.visit.create({
        data: {
          membershipId: vr.membershipId,
          businessId: vr.businessId,
          customerId: vr.customerId,
          verificationRequestId: vr.id,
        },
      });

      const updatedMembership = await tx.membership.update({
        where: { id: vr.membershipId },
        data: { totalVisits: { increment: 1 } },
      });

      const card = await tx.loyaltyCard.upsert({
        where: { membershipId_loyaltyProgramId: { membershipId: vr.membershipId, loyaltyProgramId: program.id } },
        create: { membershipId: vr.membershipId, loyaltyProgramId: program.id },
        update: {},
      });
      const issuedStampCount = await tx.loyaltyCardStamp.count({ where: { loyaltyCardId: card.id } });
      const cardPosition = issuedStampCount + 1;
      if (cardPosition > program.requiredVisits) throw new Error("CARD_COMPLETE");

      await tx.loyaltyCardStamp.create({
        data: { loyaltyCardId: card.id, visitRequestId: vr.id, cardPosition, awardedAt: now },
      });

      const rewardDefinition = program.rewardDefinitions.find((definition) => definition.cardPosition === cardPosition);
      let reward = null;
      if (rewardDefinition) {
        const claimCode = generateClaimCode();

        reward = await tx.reward.create({
          data: {
            membershipId: vr.membershipId,
            businessId: vr.businessId,
            customerId: vr.customerId,
            loyaltyProgramId: program.id,
            loyaltyCardId: card.id,
            loyaltyRewardDefinitionId: rewardDefinition.id,
            title: rewardDefinition.title,
            description: rewardDefinition.description,
            status: "AVAILABLE",
            type: "STANDARD",
            claimCode,
            expiresAt: new Date(now.getTime() + program.rewardValidityDays * 24 * 60 * 60 * 1000),
          },
        });
      }

      return {
        membershipTotalVisits: updatedMembership.totalVisits,
        cardPosition,
        rewardEarned: reward !== null,
        requiredVisits: program.requiredVisits,
        claimCode: reward?.claimCode,
      };
    });

    return NextResponse.json({
      success: true,
      approved: true,
      membershipTotalVisits: result.membershipTotalVisits,
      cardPosition: result.cardPosition,
      rewardEarned: result.rewardEarned,
      claimCode: result.claimCode,
      message: result.rewardEarned
        ? "Visit approved and reward earned!"
        : `Visit approved. Loyalty card position ${result.cardPosition}/${result.requiredVisits} awarded.`,
    });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN_NOT_BUSINESS_OWNER" || msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (msg === "NOT_FOUND") return NextResponse.json({ error: "Verification request not found." }, { status: 404 });
    if (msg === "ALREADY_PROCESSED") return NextResponse.json({ error: "This request has already been reviewed." }, { status: 409 });
    if (msg === "PROGRAM_NOT_FOUND") return NextResponse.json({ error: "The loyalty program for this request no longer exists." }, { status: 409 });
    if (msg === "CARD_COMPLETE") return NextResponse.json({ error: "This customer has already completed this loyalty card. Reject this request instead." }, { status: 409 });
    console.error("Review verification request error:", err);
    return NextResponse.json({ error: "Failed to process verification request." }, { status: 500 });
  }
}
