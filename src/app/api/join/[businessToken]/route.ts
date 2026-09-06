import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { UserRole } from "@prisma/client";
import { isValidBusinessToken } from "@/lib/token";

export const dynamic = "force-dynamic";

/**
 * POST /api/join/[businessToken]
 * Idempotently joins an authenticated CUSTOMER to the business.
 * - Enforces customer role (rejects business owners).
 * - Enforces unique(customerId, businessId) via Prisma upsert.
 * - Repeated calls never duplicate memberships.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ businessToken: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Business Owner check
    if (user.role === UserRole.BUSINESS_OWNER) {
      return NextResponse.json(
        {
          error:
            "You're logged in as a Business Owner. Please use a Customer account to join this loyalty program.",
        },
        { status: 403 }
      );
    }

    const { businessToken } = await params;
    if (!businessToken || !isValidBusinessToken(businessToken)) {
      return NextResponse.json({ error: "Invalid business token." }, { status: 404 });
    }

    const business = await prisma.business.findUnique({
      where: { businessToken },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }

    // Idempotent membership creation using unique constraint
    const existing = await prisma.membership.findUnique({
      where: {
        customerId_businessId: {
          customerId: user.id,
          businessId: business.id,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: true,
          alreadyMember: true,
          message: `You are already a member of ${business.name}.`,
        },
        { status: 200 }
      );
    }

    const membership = await prisma.membership.create({
      data: {
        customerId: user.id,
        businessId: business.id,
        currentVisits: 0,
        totalVisits: 0,
      },
    });

    return NextResponse.json(
      {
        success: true,
        alreadyMember: false,
        membershipId: membership.id,
        message: `Welcome! You have joined ${business.name}.`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Join business error:", error);
    return NextResponse.json({ error: "Failed to join business." }, { status: 500 });
  }
}
