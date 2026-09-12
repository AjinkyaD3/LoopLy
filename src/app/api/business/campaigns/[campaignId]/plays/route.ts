import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
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

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign || campaign.businessId !== business.id) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }

    const plays = await prisma.campaignPlay.findMany({
      where: { campaignId: campaign.id },
      orderBy: { playedAt: "desc" },
    });

    return NextResponse.json({ plays });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN_NOT_BUSINESS_OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Fetch campaign plays error:", err);
    return NextResponse.json({ error: "Failed to fetch plays." }, { status: 500 });
  }
}
