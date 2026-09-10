import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/business/rewards
 * Returns all AVAILABLE rewards for the owner's business (for redemption display).
 */
export async function GET() {
  try {
    const user = await requireBusinessOwner();

    const business = await prisma.business.findUnique({
      where: { ownerId: user.id },
    });

    if (!business) {
      return NextResponse.json({ error: "No business found for this owner." }, { status: 404 });
    }

    const now = new Date();
    const rewards = await prisma.reward.findMany({
      where: {
        businessId: business.id,
        status: "AVAILABLE",
        expiresAt: { gt: now },
      },
      include: {
        customer: { select: { name: true, mobileNumber: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ rewards });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN_NOT_BUSINESS_OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Fetch business rewards error:", err);
    return NextResponse.json({ error: "Failed to fetch rewards." }, { status: 500 });
  }
}
