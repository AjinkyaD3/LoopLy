import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

import { BusinessUpdateSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

/**
 * GET /api/business
 * Retrieves the authenticated owner's business, loyalty program, and public join link.
 * Never accepts a client-provided business ID.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }


    const business = await prisma.business.findUnique({
      where: { ownerId: user.id },
      include: {
        loyaltyProgram: true,
      },
    });

    if (!business) {
      return NextResponse.json({ business: null }, { status: 200 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const joinUrl = `${appUrl}/join/${business.businessToken}`;

    return NextResponse.json(
      {
        business: {
          id: business.id,
          name: business.name,
          businessToken: business.businessToken,
          joinUrl,
          createdAt: business.createdAt,
          updatedAt: business.updatedAt,
          loyaltyProgram: business.loyaltyProgram,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Fetch business error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve business information." },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/business
 * Updates the business profile (name).
 * Immutable fields: id, ownerId, businessToken are never updated.
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }


    const existingBusiness = await prisma.business.findUnique({
      where: { ownerId: user.id },
    });

    if (!existingBusiness) {
      return NextResponse.json(
        { error: "No business found for this owner." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = BusinessUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Invalid input";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { name } = parsed.data;

    const updated = await prisma.business.update({
      where: { id: existingBusiness.id },
      data: { name },
      include: { loyaltyProgram: true },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const joinUrl = `${appUrl}/join/${updated.businessToken}`;

    return NextResponse.json(
      {
        success: true,
        business: {
          id: updated.id,
          name: updated.name,
          businessToken: updated.businessToken,
          joinUrl,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
          loyaltyProgram: updated.loyaltyProgram,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Update business error:", error);
    return NextResponse.json(
      { error: "Failed to update business profile." },
      { status: 500 }
    );
  }
}
