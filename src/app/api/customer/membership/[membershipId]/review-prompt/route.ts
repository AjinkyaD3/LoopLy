import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/customer/membership/[membershipId]/review-prompt
 * Records that GoogleReviewModal was shown (and dismissed either way) for this membership,
 * so the 30-day cooldown it already implements client-side can persist server-side.
 *
 * Same no-customer-auth trust model as every other /api/customer/* route — a low-value
 * write (a timestamp, not money or a prize), so no additional protection beyond confirming
 * the membership exists.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { membershipId: string } }
) {
  try {
    const { membershipId } = params;

    const membership = await prisma.membership.findUnique({ where: { id: membershipId } });
    if (!membership) {
      return NextResponse.json({ error: "Membership not found." }, { status: 404 });
    }

    await prisma.membership.update({
      where: { id: membershipId },
      data: { reviewPromptedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Review prompt error:", error);
    return NextResponse.json({ error: "Failed to record review prompt." }, { status: 500 });
  }
}
