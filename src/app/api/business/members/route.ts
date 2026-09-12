import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessOwner } from "@/lib/auth";
import { computeThresholdEligibility } from "@/lib/loyaltyProgress";

export const dynamic = "force-dynamic";

/**
 * GET /api/business/members
 * Returns the list of joined customer memberships for the owner's business.
 * Supports query parameter `?search=...` to filter by customer name or email.
 *
 * Security:
 * - Scoped strictly to `Business.ownerId === user.id`.
 * - Passwords and sensitive customer session data are never exposed.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireBusinessOwner();

    const business = await prisma.business.findUnique({
      where: { ownerId: user.id },
      include: { loyaltyProgram: true },
    });

    if (!business || !business.loyaltyProgram) {
      return NextResponse.json({ error: "No business found for this owner." }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim().toLowerCase() || "";

    // Query memberships with search filtering if provided
    const memberships = await prisma.membership.findMany({
      where: {
        businessId: business.id,
        ...(search
          ? {
              customer: {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { mobileNumber: { contains: search } },
                ],
              },
            }
          : {}),
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            mobileNumber: true,
            createdAt: true,
          },
        },
        rewards: {
          select: {
            id: true,
            status: true,
            expiresAt: true,
            redeemedAt: true,
            claimCode: true,
          },
        },
        visits: {
          orderBy: { visitedAt: "desc" },
          take: 1,
          select: { visitedAt: true },
        },
      },
      orderBy: { joinedAt: "desc" },
    });

    const now = new Date();
    const requiredVisits = business.loyaltyProgram.requiredVisits;

    const formattedMembers = await Promise.all(memberships.map(async (m) => {
      const activeRewards = m.rewards.filter(
        (r) => r.status === "AVAILABLE" && r.expiresAt > now
      );
      const activeClaimCodes = activeRewards.map(r => r.claimCode).filter(Boolean);
      const redeemedRewardsCount = m.rewards.filter((r) => r.status === "REDEEMED").length;
      const lastVisitAt = m.visits[0]?.visitedAt ?? null;

      const eligibility = await computeThresholdEligibility(prisma, m.id, business.loyaltyProgram!);

      return {
        id: m.id,
        customerId: m.customer.id,
        name: m.customer.name,
        mobileNumber: m.customer.mobileNumber,
        joinedAt: m.joinedAt,
        currentVisits: eligibility.qualifyingVisits,
        totalVisits: m.totalVisits,
        requiredVisits,
        activeRewardsCount: activeRewards.length,
        activeClaimCodes,
        redeemedRewardsCount,
        lastVisitAt,
      };
    }));

    return NextResponse.json({
      members: formattedMembers,
      requiredVisits,
      totalCount: formattedMembers.length,
    });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN_NOT_BUSINESS_OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Fetch members error:", err);
    return NextResponse.json({ error: "Failed to fetch members." }, { status: 500 });
  }
}
