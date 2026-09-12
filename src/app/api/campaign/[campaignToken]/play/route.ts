import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import prisma from "@/lib/prisma";
import { isValidToken } from "@/lib/token";
import { getCampaignStatus } from "@/lib/campaign";
import { CampaignPlaySchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

// Bounds the re-roll loop below — can never need more attempts than there are prizes to exhaust.
const MAX_DRAW_ATTEMPTS = 50;

/**
 * POST /api/campaign/[campaignToken]/play
 * Public, unauthenticated. One play per (campaignId, mobileNumber), enforced at the DB level
 * via CampaignPlay's unique constraint — this route's pre-checks are a UX nicety, not the
 * actual safety net.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { campaignToken: string } }
) {
  try {
    const { campaignToken } = params;
    if (!campaignToken || !isValidToken(campaignToken)) {
      return NextResponse.json({ error: "Invalid campaign token." }, { status: 404 });
    }

    const body = await request.json();
    const parsed = CampaignPlaySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    const { mobileNumber, customerName } = parsed.data;

    const campaign = await prisma.campaign.findUnique({
      where: { campaignToken },
      include: { prizes: true },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }

    const status = getCampaignStatus(campaign, campaign.prizes);
    if (status === "SCHEDULED") {
      return NextResponse.json({ error: "This campaign hasn't started yet." }, { status: 409 });
    }
    if (status === "ENDED") {
      return NextResponse.json({ error: "This campaign has ended." }, { status: 409 });
    }

    // Fast, friendly pre-check — the real guard is the DB unique constraint below.
    const existingPlay = await prisma.campaignPlay.findUnique({
      where: { campaignId_mobileNumber: { campaignId: campaign.id, mobileNumber } },
    });
    if (existingPlay) {
      return NextResponse.json({ error: "You've already played this campaign." }, { status: 409 });
    }

    let play = null;
    let attempt = 0;

    while (!play && attempt < MAX_DRAW_ATTEMPTS) {
      attempt++;

      try {
        play = await prisma.$transaction(async (tx) => {
          const inStock = await tx.campaignPrize.findMany({
            where: { campaignId: campaign.id, remainingStock: { gt: 0 } },
          });

          if (inStock.length === 0) {
            throw new Error("CAMPAIGN_ENDED");
          }

          const totalWeight = inStock.reduce((sum, p) => sum + p.weight, 0);
          let roll = randomInt(totalWeight);
          let chosen = inStock[inStock.length - 1];
          for (const p of inStock) {
            if (roll < p.weight) {
              chosen = p;
              break;
            }
            roll -= p.weight;
          }

          const decremented = await tx.campaignPrize.updateMany({
            where: { id: chosen.id, remainingStock: { gt: 0 } },
            data: { remainingStock: { decrement: 1 } },
          });

          if (decremented.count === 0) {
            // Someone else took the last unit microseconds earlier — signal the outer loop to re-roll.
            throw new Error("RETRY_DRAW");
          }

          // Generate a 6-character claim code if they won a prize
          let claimCode = null;
          const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
          claimCode = Array.from({ length: 6 })
            .map(() => chars.charAt(Math.floor(Math.random() * chars.length)))
            .join("");

          return tx.campaignPlay.create({
            data: {
              campaignId: campaign.id,
              mobileNumber,
              customerName: customerName || null,
              wonPrizeId: chosen.id,
              revealedPrize: chosen.title,
              claimCode,
              status: "AVAILABLE",
            },
          });
        });
      } catch (txError: any) {
        if (txError.message === "RETRY_DRAW") {
          continue; // re-roll against the refreshed in-stock set
        }
        if (txError.message === "CAMPAIGN_ENDED") {
          return NextResponse.json({ error: "This campaign has ended." }, { status: 409 });
        }
        if (txError.code === "P2002") {
          // A concurrent request for the same mobile number won the race — stock was never
          // consumed for this rejected attempt, since the decrement and the play-row insert
          // are in the same transaction.
          return NextResponse.json({ error: "You've already played this campaign." }, { status: 409 });
        }
        throw txError;
      }
    }

    if (!play) {
      return NextResponse.json({ error: "This campaign has ended." }, { status: 409 });
    }

    return NextResponse.json({ success: true, play }, { status: 201 });
  } catch (error) {
    console.error("Campaign play error:", error);
    return NextResponse.json({ error: "Failed to process campaign play." }, { status: 500 });
  }
}
