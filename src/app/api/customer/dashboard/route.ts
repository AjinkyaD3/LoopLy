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
            loyaltyProgram: true,
          }
        },
        memberships: true,
        rewards: {
          orderBy: { createdAt: "desc" },
          include: {
            loyaltyProgram: true
          }
        }
      }
    });

    if (!customers || customers.length === 0) {
      return NextResponse.json({ success: true, memberships: [] }, { status: 200 });
    }

    // Map into a unified response
    const memberships = customers.map(customer => {
      const business = customer.business;
      const loyaltyProgram = business.loyaltyProgram;
      
      // If a business doesn't have an active program, we could potentially skip it, 
      // but returning it as history is fine. We'll only return if there's a program.
      if (!loyaltyProgram) return null;

      const membership = customer.memberships.find(m => m.businessId === business.id);
      
      const baseData = {
        businessName: business.name,
        programName: loyaltyProgram.programName,
        programType: loyaltyProgram.type,
      };

      if (loyaltyProgram.type === "VISITS") {
        const currentVisits = membership?.currentVisits || 0;
        const requiredVisits = loyaltyProgram.requiredVisits;
        const rewardAvailable = currentVisits >= requiredVisits;
        
        // Also check if there's an already-minted reward waiting to be claimed
        // For VISITS, a reward is minted when currentVisits >= requiredVisits.
        // It has claimCode attached.
        const pendingReward = customer.rewards.find(r => 
          r.businessId === business.id && 
          r.loyaltyProgramId === loyaltyProgram.id &&
          r.status === "AVAILABLE" && 
          r.type === "STANDARD"
        );

        return {
          ...baseData,
          progress: {
            currentVisits,
            requiredVisits,
            rewardAvailable: rewardAvailable || !!pendingReward,
            rewardTitle: loyaltyProgram.rewardTitle
          }
        };
      } else {
        // SCRATCH_CARD
        // Get all past won prizes where a prize was actually revealed
        const wins = customer.rewards
          .filter(r => 
            r.businessId === business.id && 
            r.loyaltyProgramId === loyaltyProgram.id &&
            r.type === "SCRATCH_CARD" &&
            r.revealedPrize
          )
          .map(r => ({
            title: r.revealedPrize,
            date: r.createdAt.toISOString()
          }));

        return {
          ...baseData,
          wins
        };
      }
    }).filter(Boolean);

    return NextResponse.json({ success: true, memberships }, { status: 200 });

  } catch (error: any) {
    console.error("Dashboard lookup error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
