import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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

    // Compute progress: derived from approved visit requests or use stored counter
    // For now we use the stored counter `currentVisits` which should be incremented on approval.
    const eligibleForReward = membership.currentVisits >= business.loyaltyProgram.requiredVisits;

    return NextResponse.json({
      exists: true,
      name: customer.name,
      totalVisits: membership.totalVisits,
      currentVisits: membership.currentVisits,
      requiredVisits: business.loyaltyProgram.requiredVisits,
      eligibleForReward,
    }, { status: 200 });

  } catch (error) {
    console.error("Progress check error:", error);
    return NextResponse.json({ error: "Failed to fetch progress." }, { status: 500 });
  }
}
