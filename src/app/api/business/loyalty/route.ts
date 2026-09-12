import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireOwnerBusiness } from "@/lib/auth";
import { LoyaltyProgramSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

/** Creates one dated loyalty-card program. The business QR is permanent and is not
 * created or changed here; it resolves the active program when a customer scans it. */
export async function POST(request: NextRequest) {
  try {
    const { business } = await requireOwnerBusiness();
    const parsed = LoyaltyProgramSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const now = new Date();
    const currentProgram = await prisma.loyaltyProgram.findFirst({
      where: { businessId: business.id, endedManuallyAt: null, endsAt: { gte: now } },
      select: { id: true },
    });
    if (currentProgram) {
      return NextResponse.json({ error: "End the current loyalty program before creating another one." }, { status: 409 });
    }

    const { programName, startsAt, endsAt, requiredVisits, rewards, rewardValidityDays } = parsed.data;
    const firstReward = [...rewards].sort((a, b) => a.cardPosition - b.cardPosition)[0];
    const loyaltyProgram = await prisma.loyaltyProgram.create({
      data: {
        businessId: business.id,
        programName,
        startsAt,
        endsAt,
        requiredVisits,
        // Legacy required fields retained for historical reward compatibility.
        rewardTitle: firstReward.title,
        rewardDescription: firstReward.description,
        rewardValidityDays,
        verificationMethod: "VISIT_CONFIRMATION",
        isActive: true,
        rewardDefinitions: { create: rewards },
      },
      include: { rewardDefinitions: { orderBy: { cardPosition: "asc" } } },
    });
    await prisma.business.update({ where: { id: business.id }, data: { loyaltyProgramId: loyaltyProgram.id } });

    return NextResponse.json({ success: true, loyaltyProgram }, { status: 201 });
  } catch (error: any) {
    if (["UNAUTHORIZED", "NO_OWNED_BUSINESS"].includes(error.message)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Create loyalty program error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Only specific fields can be edited after creation: isActive toggle and reward titles/descriptions.
// Core logic like dates, visits, and card positions remain immutable to prevent breaking existing user state.
export async function PUT(request: NextRequest) {
  try {
    const { business } = await requireOwnerBusiness();
    const payload = await request.json();
    const { isActive, rewards } = payload; // rewards should be array of { id: string, title: string, description: string }

    const now = new Date();
    const currentProgram = await prisma.loyaltyProgram.findFirst({
      where: { businessId: business.id, endedManuallyAt: null, endsAt: { gte: now } },
      include: { rewardDefinitions: true },
    });

    if (!currentProgram) {
      return NextResponse.json({ error: "No active loyalty program found to edit." }, { status: 404 });
    }

    // Prepare transaction for updating program and its rewards
    const txs: any[] = [];
    
    if (typeof isActive === "boolean") {
      txs.push(prisma.loyaltyProgram.update({
        where: { id: currentProgram.id },
        data: { isActive },
      }));
    }

    if (Array.isArray(rewards)) {
      for (const updatedReward of rewards) {
        // Ensure this reward actually belongs to the current program
        const existingReward = currentProgram.rewardDefinitions.find(r => r.id === updatedReward.id);
        if (existingReward && (updatedReward.title !== undefined || updatedReward.description !== undefined)) {
          txs.push(prisma.loyaltyRewardDefinition.update({
            where: { id: existingReward.id },
            data: {
              title: updatedReward.title ?? existingReward.title,
              description: updatedReward.description ?? existingReward.description,
            }
          }));
        }
      }
    }

    if (txs.length > 0) {
      await prisma.$transaction(txs);
    }

    return NextResponse.json({ success: true, message: "Loyalty program updated successfully." });
  } catch (error: any) {
    if (["UNAUTHORIZED", "NO_OWNED_BUSINESS"].includes(error.message)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Edit loyalty program error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Ends the current program without deleting customer cards, pending requests, or rewards. */
export async function DELETE() {
  try {
    const { business } = await requireOwnerBusiness();
    const now = new Date();
    const program = await prisma.loyaltyProgram.findFirst({
      where: { businessId: business.id, endedManuallyAt: null, endsAt: { gte: now } },
      orderBy: { startsAt: "desc" },
    });
    if (!program) return NextResponse.json({ error: "No active loyalty program found." }, { status: 404 });

    await prisma.$transaction([
      prisma.loyaltyProgram.update({ where: { id: program.id }, data: { endedManuallyAt: now } }),
      prisma.business.update({ where: { id: business.id }, data: { loyaltyProgramId: null } }),
    ]);
    return NextResponse.json({ success: true, message: "Loyalty program ended." });
  } catch (error: any) {
    if (["UNAUTHORIZED", "NO_OWNED_BUSINESS"].includes(error.message)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("End loyalty program error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
