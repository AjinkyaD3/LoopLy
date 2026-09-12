import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const mobileNumber = request.nextUrl.searchParams.get("mobileNumber");

    if (!mobileNumber || mobileNumber.trim().length < 5) {
      return NextResponse.json({ error: "Invalid mobile number" }, { status: 400 });
    }

    // Find all customers across all businesses matching this mobile number
    const customers = await prisma.customer.findMany({
      where: { mobileNumber: mobileNumber.trim() },
      include: {
        business: {
          include: {
            loyaltyProgram: true, // Legacy pointer for active program, still useful if needed
          }
        },
        memberships: {
          include: {
            loyaltyCards: {
              include: {
                loyaltyProgram: {
                  include: {
                    rewardDefinitions: {
                      orderBy: { cardPosition: "asc" }
                    }
                  }
                },
                stamps: {
                  orderBy: { cardPosition: "asc" }
                },
                rewards: {
                  where: {
                    status: { in: ["AVAILABLE", "REDEEMED"] },
                    type: "STANDARD"
                  }
                }
              },
              orderBy: { createdAt: "desc" }
            }
          }
        }
      }
    });

    if (!customers || customers.length === 0) {
      return NextResponse.json({ success: true, cards: [] }, { status: 200 });
    }

    const cards = [];

    for (const customer of customers) {
      const business = customer.business;
      const membership = customer.memberships.find(m => m.businessId === business.id);
      if (!membership || !membership.loyaltyCards.length) continue;

      // Map each card this customer has
      for (const card of membership.loyaltyCards) {
        const program = card.loyaltyProgram;
        const stamps = card.stamps.length;
        const requiredVisits = program.requiredVisits;
        
        // Find the next available reward definition that hasn't been reached yet
        const nextRewardDef = program.rewardDefinitions.find(d => d.cardPosition > stamps);
        
        cards.push({
          businessName: business.name,
          programName: program.programName,
          startsAt: program.startsAt,
          endsAt: program.endsAt,
          isActive: program.isActive && !program.endedManuallyAt && new Date() >= program.startsAt && new Date() <= program.endsAt,
          progress: {
            currentStamps: stamps,
            requiredStamps: requiredVisits,
            availableRewards: card.rewards.filter(r => r.status === "AVAILABLE").map(r => ({
              title: r.title,
              description: r.description,
              claimCode: r.claimCode
            })),
            redeemedRewards: card.rewards.filter(r => r.status === "REDEEMED").map(r => ({
              title: r.title,
              description: r.description,
              redeemedAt: r.redeemedAt
            })),
            nextReward: nextRewardDef ? {
              title: nextRewardDef.title,
              position: nextRewardDef.cardPosition,
              stampsNeeded: nextRewardDef.cardPosition - stamps
            } : null
          }
        });
      }
    }

    // Sort active cards first, then by most recent
    cards.sort((a, b) => {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      return new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime();
    });

    // Fetch Campaign Plays for this mobile number that have a claimCode
    const campaignPlays = await prisma.campaignPlay.findMany({
      where: {
        mobileNumber: mobileNumber.trim(),
        claimCode: { not: null }
      },
      include: {
        campaign: { select: { name: true, business: { select: { name: true } } } }
      },
      orderBy: { playedAt: "desc" }
    });

    const campaigns = campaignPlays.map(play => ({
      id: play.id,
      businessName: play.campaign.business.name,
      campaignName: play.campaign.name,
      prize: play.revealedPrize,
      claimCode: play.claimCode,
      status: play.status,
      playedAt: play.playedAt,
      redeemedAt: play.redeemedAt
    }));

    return NextResponse.json({ success: true, cards, campaigns }, { status: 200 });

  } catch (error: any) {
    console.error("Dashboard lookup error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
