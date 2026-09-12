import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { computeThresholdEligibility } from "@/lib/loyaltyProgress";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const mobileNumber = request.nextUrl.searchParams.get("mobileNumber");

    if (!mobileNumber || mobileNumber.trim().length < 5) {
      return NextResponse.json({ error: "Invalid mobile number" }, { status: 400 });
    }

    // Find all customers across all businesses matching this mobile number
    const customers = await prisma.customer.findMany({
      where: { mobileNumber: mobileNumber.trim() },
      include: {
        business: {
          include: {
            loyaltyProgram: true,
          }
        },
        memberships: true,
        rewards: {
          orderBy: { createdAt: "desc" },
          include: {
            loyaltyProgram: true
          }
        }
      }
    });

    if (!customers || customers.length === 0) {
      return NextResponse.json({ success: true, memberships: [] }, { status: 200 });
    }

    // Map into a unified response
    const memberships = await Promise.all(customers.map(async customer => {
      const business = customer.business;
      const loyaltyProgram = business.loyaltyProgram;

      // If a business doesn't have an active program, we could potentially skip it,
      // but returning it as history is fine. We'll only return if there's a program.
      if (!loyaltyProgram) return null;

      const membership = customer.memberships.find(m => m.businessId === business.id);
      if (!membership) return null;

      const eligibility = await computeThresholdEligibility(prisma, membership.id, loyaltyProgram);
      const requiredVisits = loyaltyProgram.requiredVisits;

      // Also check if there's an already-minted reward waiting to be claimed.
      const pendingReward = customer.rewards.find(r =>
        r.businessId === business.id &&
        r.loyaltyProgramId === loyaltyProgram.id &&
        r.status === "AVAILABLE" &&
        r.type === "STANDARD"
      );

      return {
        businessName: business.name,
        programName: loyaltyProgram.programName,
        progress: {
          currentVisits: eligibility.qualifyingVisits,
          requiredVisits,
          rewardAvailable: eligibility.qualifies || !!pendingReward,
          rewardTitle: loyaltyProgram.rewardTitle
        }
      };
    }));

    return NextResponse.json({ success: true, memberships: memberships.filter(Boolean) }, { status: 200 });

  } catch (error: any) {
    console.error("Dashboard lookup error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
