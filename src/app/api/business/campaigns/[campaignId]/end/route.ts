import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireOwnerBusiness } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/business/campaigns/[campaignId]/end
 * Manually ends a campaign early, independent of its endsAt date. Idempotent — ending an
 * already-ended campaign is a no-op, not an error.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    const { business } = await requireOwnerBusiness();
    const { campaignId } = params;

    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });

    if (!campaign || campaign.businessId !== business.id) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }

    if (!campaign.endedManuallyAt) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { endedManuallyAt: new Date() },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN_NOT_BUSINESS_OWNER" || msg === "NO_OWNED_BUSINESS") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("End campaign error:", err);
    return NextResponse.json({ error: "Failed to end campaign." }, { status: 500 });
  }
}
