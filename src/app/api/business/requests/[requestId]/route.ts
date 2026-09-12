import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessOwner } from "@/lib/auth";
import { VerificationReviewSchema } from "@/lib/validations";
import { computeThresholdEligibility } from "@/lib/loyaltyProgress";

function generateClaimCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const dynamic = "force-dynamic";

/**
 * PATCH /api/business/requests/[requestId]
 * Approve or reject a pending verification request.
 *
 * APPROVE (atomic Prisma transaction):
 *   1. Re-verify ownership and PENDING status inside the transaction.
 *   2. Mark request APPROVED + reviewedAt.
 *   3. Create immutable Visit (unique verificationRequestId prevents duplicate visits).
 *   4. Increment membership totalVisits (lifetime tally only — no resettable counter).
 *   5. Compute threshold eligibility per the program's window (LIFETIME/ROLLING/
 *      FIXED_PERIOD) via computeThresholdEligibility() — if it qualifies, create a Reward
 *      stamped with the next ordinal thresholdCycle. Reward.@@unique([membershipId,
 *      loyaltyProgramId, thresholdCycle]) is the DB-level guard against ever minting the
 *      same cycle twice, even under a concurrent-approval race.
 *
 * REJECT:
 *   - Mark request REJECTED + reviewedAt + optional rejectionReason.
 *   - No Visit, no membership change, no Reward.
 *
 * Security:
 *   - Business resolved via ownerId only (never from body).
 *   - requestId cross-checked against ownedBusiness.id inside transaction.
 *   - Unique constraint on Visit.verificationRequestId prevents double-approval race conditions.
 */
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

    // Resolve owner's business (tenant isolation)
    const business = await prisma.business.findUnique({
      where: { ownerId: user.id },
      include: { loyaltyProgram: true },
    });

    if (!business || !business.loyaltyProgram) {
      return NextResponse.json({ error: "No business found for this owner." }, { status: 404 });
    }

    if (decision === "REJECTED") {
      // Simple update — no visit, no membership change
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

    // APPROVE — atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // Re-fetch inside transaction for consistency
      const vr = await tx.visitRequest.findUnique({
        where: { id: requestId },
        include: { membership: true },
      });

      if (!vr) throw new Error("NOT_FOUND");
      if (vr.businessId !== business.id) throw new Error("FORBIDDEN");
      if (vr.status !== "PENDING") throw new Error("ALREADY_PROCESSED");

      const now = new Date();

      // 1. Approve the request
      await tx.visitRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED", reviewedAt: now },
      });

      // 2. Create immutable Visit (unique constraint on verificationRequestId prevents double)
      const newVisit = await tx.visit.create({
        data: {
          membershipId: vr.membershipId,
          businessId: vr.businessId,
          customerId: vr.customerId,
          verificationRequestId: vr.id,
        },
      });

      // 3. Increment lifetime visit tally
      const updatedMembership = await tx.membership.update({
        where: { id: vr.membershipId },
        data: { totalVisits: { increment: 1 } },
      });

      const program = business.loyaltyProgram!;
      const { requiredVisits, rewardTitle, rewardDescription, rewardValidityDays, id: loyaltyProgramId } = program;

      let reward = null;

      // 4. Check windowed threshold eligibility and create reward if earned
      const eligibility = await computeThresholdEligibility(tx, vr.membershipId, program);

      if (eligibility.qualifies) {
        const claimCode = generateClaimCode();

        reward = await tx.reward.create({
          data: {
            membershipId: vr.membershipId,
            businessId: vr.businessId,
            customerId: vr.customerId,
            loyaltyProgramId,
            title: rewardTitle,
            description: rewardDescription,
            status: "AVAILABLE",
            type: "STANDARD",
            claimCode,
            thresholdCycle: eligibility.nextCycle,
            thresholdVisitId: newVisit.id,
            expiresAt: new Date(now.getTime() + rewardValidityDays * 24 * 60 * 60 * 1000),
          },
        });
      }

      return {
        membershipTotalVisits: updatedMembership.totalVisits,
        qualifyingVisits: eligibility.qualifyingVisits,
        rewardEarned: reward !== null,
        requiredVisits,
        claimCode: reward?.claimCode,
      };
    });

    return NextResponse.json({
      success: true,
      approved: true,
      membershipTotalVisits: result.membershipTotalVisits,
      qualifyingVisits: result.qualifyingVisits,
      rewardEarned: result.rewardEarned,
      claimCode: result.claimCode,
      message: result.rewardEarned
        ? "Visit approved and reward earned!"
        : `Visit approved. ${result.qualifyingVisits}/${result.requiredVisits} visits toward next reward.`,
    });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN_NOT_BUSINESS_OWNER" || msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (msg === "NOT_FOUND") return NextResponse.json({ error: "Verification request not found." }, { status: 404 });
    if (msg === "ALREADY_PROCESSED") return NextResponse.json({ error: "This request has already been reviewed." }, { status: 409 });
    console.error("Review verification request error:", err);
    return NextResponse.json({ error: "Failed to process verification request." }, { status: 500 });
  }
}
