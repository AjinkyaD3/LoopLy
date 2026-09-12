import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"));
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

// PUT (business rename) was removed here — it was already dead code (no live UI called it;
// BusinessUpdateSchema requires only `name`, but even the original BusinessDashboardTabs.tsx
// never wired handleUpdateBusiness to a rendered <form>). PUT /api/business/account is the
// one live business-update route and now correctly persists all six fields.
