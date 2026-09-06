import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isValidBusinessToken } from "@/lib/token";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ businessToken: string }> }
) {
  try {
    const { businessToken } = await params;

    // 1. Validate token format before querying database
    if (!businessToken || !isValidBusinessToken(businessToken)) {
      return NextResponse.json(
        { error: "Invalid business token format." },
        { status: 404 }
      );
    }

    // 2. Query business & loyalty program
    const business = await prisma.business.findUnique({
      where: { businessToken },
      include: {
        loyaltyProgram: true,
      },
    });

    if (!business || !business.loyaltyProgram) {
      return NextResponse.json(
        { error: "Business not found." },
        { status: 404 }
      );
    }

    // 3. Return strictly sanitized public projection
    return NextResponse.json(
      {
        name: business.name,
        programName: business.loyaltyProgram.programName,
        requiredVisits: business.loyaltyProgram.requiredVisits,
        rewardTitle: business.loyaltyProgram.rewardTitle,
        rewardDescription: business.loyaltyProgram.rewardDescription,
        verificationMethod: business.loyaltyProgram.verificationMethod,
        isActive: business.loyaltyProgram.isActive,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Public business lookup error:", error);
    return NextResponse.json(
      { error: "Failed to resolve business." },
      { status: 500 }
    );
  }
}
