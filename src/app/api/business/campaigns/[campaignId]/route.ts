import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessOwner } from "@/lib/auth";
import { getCampaignStatus } from "@/lib/campaign";

export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    const user = await requireBusinessOwner();
    const { campaignId } = params;
    
    if (!campaignId) {
      return NextResponse.json({ error: "Campaign ID is required." }, { status: 400 });
    }

    const business = await prisma.business.findUnique({
      where: { ownerId: user.id },
    });

    if (!business) {
      return NextResponse.json({ error: "No business found." }, { status: 404 });
    }

    const body = await request.json();
    const { prizes } = body; // Array of { id, weight, totalStock }

    if (!Array.isArray(prizes)) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { prizes: true },
    });

    if (!campaign || campaign.businessId !== business.id) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }

    const status = getCampaignStatus(campaign, campaign.prizes);
    if (status === "ENDED") {
      return NextResponse.json({ error: "Cannot edit an ended campaign." }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      for (const p of prizes) {
        const existingPrize = campaign.prizes.find(cp => cp.id === p.id);
        if (!existingPrize) continue;

        // Calculate new remaining stock
        const stockDiff = p.totalStock - existingPrize.totalStock;
        const newRemainingStock = Math.max(0, existingPrize.remainingStock + stockDiff);

        await tx.campaignPrize.update({
          where: { id: p.id },
          data: {
            weight: p.weight,
            totalStock: p.totalStock,
            remainingStock: newRemainingStock,
          }
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN_NOT_BUSINESS_OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Update campaign error:", err);
    return NextResponse.json({ error: "Failed to update campaign." }, { status: 500 });
  }
}
