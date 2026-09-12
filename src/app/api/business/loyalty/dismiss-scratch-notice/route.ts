import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireOwnerBusiness } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/business/loyalty/dismiss-scratch-notice
 * Clears the one-time "your scratch card has moved to Campaigns" banner for the owner's
 * loyalty program, set on the 5 programs auto-paused when scratch-card mode was retired
 * from LoyaltyProgram.
 */
export async function POST() {
  try {
    const { business } = await requireOwnerBusiness();

    if (!business.loyaltyProgram) {
      return NextResponse.json({ error: "No loyalty program configured." }, { status: 404 });
    }

    await prisma.loyaltyProgram.update({
      where: { id: business.loyaltyProgram.id },
      data: { retiredScratchNotice: false },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN_NOT_BUSINESS_OWNER" || error.message === "NO_OWNED_BUSINESS") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Dismiss scratch notice error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
