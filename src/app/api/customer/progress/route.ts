import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { computeThresholdEligibility } from "@/lib/loyaltyProgress";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const mobileNumber = searchParams.get("mobileNumber");
    const businessId = searchParams.get("businessId");

    if (!mobileNumber || !businessId) {
      return NextResponse.json({ error: "Missing mobileNumber or businessId" }, { status: 400 });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { loyaltyProgram: true },
    });

    if (!business || !business.loyaltyProgram) {
      return NextResponse.json({ error: "Business or loyalty program not found" }, { status: 404 });
    }

    const customer = await prisma.customer.findUnique({
      where: {
        businessId_mobileNumber: {
          businessId,
          mobileNumber,
        },
      },
      include: {
        memberships: {
          where: { businessId },
        },
      },
    });

    if (!customer || customer.memberships.length === 0) {
      return NextResponse.json({
        exists: false,
        totalVisits: 0,
        currentVisits: 0,
        requiredVisits: business.loyaltyProgram.requiredVisits,
        eligibleForReward: false,
      });
    }

    const membership = customer.memberships[0];

    const eligibility = await computeThresholdEligibility(prisma, membership.id, business.loyaltyProgram);

    return NextResponse.json({
      exists: true,
      name: customer.name,
      membershipId: membership.id,
      reviewPromptedAt: membership.reviewPromptedAt,
      totalVisits: membership.totalVisits,
      currentVisits: eligibility.qualifyingVisits,
      requiredVisits: business.loyaltyProgram.requiredVisits,
      eligibleForReward: eligibility.qualifies,
    }, { status: 200 });

  } catch (error) {
    console.error("Progress check error:", error);
    return NextResponse.json({ error: "Failed to fetch progress." }, { status: 500 });
  }
}
