import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/business/analytics
 * Returns real-time analytics, KPIs, and recent activity timeline for the authenticated owner's business.
 *
 * Security:
 * - Strictly derived from authenticated session: `Business.ownerId === user.id`.
 * - Zero cross-tenant data leakage.
 */
export async function GET() {
  try {
    const user = await requireBusinessOwner();

    const business = await prisma.business.findUnique({
      where: { ownerId: user.id },
      include: { loyaltyProgram: true },
    });

    if (!business) {
      return NextResponse.json({ error: "No business found for this owner." }, { status: 404 });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Parallel aggregate queries for high performance
    const [
      totalMembers,
      repeatMembersCount,
      totalVisits,
      visitsLast30Days,
      rewardsIssued,
      rewardsRedeemed,
      activeRewardsCount,
      pendingRequestsCount,
      recentVisits,
      recentRedemptions,
      recentMemberships,
    ] = await Promise.all([
      // 1. Total members
      prisma.membership.count({ where: { businessId: business.id } }),

      // 2. Repeat members (>= 2 total visits)
      prisma.membership.count({
        where: { businessId: business.id, totalVisits: { gte: 2 } },
      }),

      // 3. Total lifetime verified visits
      prisma.visit.count({ where: { businessId: business.id } }),

      // 4. Visits in the last 30 days
      prisma.visit.count({
        where: {
          businessId: business.id,
          visitedAt: { gte: thirtyDaysAgo },
        },
      }),

      // 5. Total rewards ever issued
      prisma.reward.count({ where: { businessId: business.id } }),

      // 6. Total rewards redeemed
      prisma.reward.count({
        where: { businessId: business.id, status: "REDEEMED" },
      }),

      // 7. Active rewards currently claimable
      prisma.reward.count({
        where: {
          businessId: business.id,
          status: "AVAILABLE",
          expiresAt: { gt: now },
        },
      }),

      // 8. Pending verification requests awaiting owner action
      prisma.visitRequest.count({
        where: { businessId: business.id, status: "PENDING" },
      }),

      // 9. Recent verified visits
      prisma.visit.findMany({
        where: { businessId: business.id },
        include: { customer: { select: { name: true, mobileNumber: true } } },
        orderBy: { visitedAt: "desc" },
        take: 5,
      }),

      // 10. Recent redemptions
      prisma.reward.findMany({
        where: { businessId: business.id, status: "REDEEMED" },
        include: { customer: { select: { name: true, mobileNumber: true } } },
        orderBy: { redeemedAt: "desc" },
        take: 5,
      }),

      // 11. Recent new members
      prisma.membership.findMany({
        where: { businessId: business.id },
        include: { customer: { select: { name: true, mobileNumber: true } } },
        orderBy: { joinedAt: "desc" },
        take: 5,
      }),
    ]);

    // Calculate repeat customer rate percentage
    const repeatRate = totalMembers > 0 ? Math.round((repeatMembersCount / totalMembers) * 100) : 0;

    // Combine recent activities into a single sorted timeline
    interface TimelineItem {
      id: string;
      type: "JOIN" | "VISIT" | "REDEEM";
      title: string;
      customerName: string;
      customerMobile: string;
      timestamp: Date;
    }

    const timeline: TimelineItem[] = [];

    recentMemberships.forEach((m) => {
      timeline.push({
        id: `join-${m.id}`,
        type: "JOIN",
        title: "Joined loyalty club",
        customerName: m.customer.name || "Unknown",
        customerMobile: m.customer.mobileNumber || "",
        timestamp: m.joinedAt,
      });
    });

    recentVisits.forEach((v) => {
      timeline.push({
        id: `visit-${v.id}`,
        type: "VISIT",
        title: "Verified visit recorded",
        customerName: v.customer.name || "Unknown",
        customerMobile: v.customer.mobileNumber || "",
        timestamp: v.visitedAt,
      });
    });

    recentRedemptions.forEach((r) => {
      if (r.redeemedAt) {
        timeline.push({
          id: `redeem-${r.id}`,
          type: "REDEEM",
          title: `Redeemed reward: ${r.title}`,
          customerName: r.customer.name || "Unknown",
          customerMobile: r.customer.mobileNumber || "",
          timestamp: r.redeemedAt,
        });
      }
    });

    // Sort timeline descending by timestamp and take top 10
    timeline.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const recentActivity = timeline.slice(0, 10);

    return NextResponse.json({
      businessName: business.name,
      metrics: {
        totalMembers,
        repeatMembersCount,
        repeatRate,
        totalVisits,
        visitsLast30Days,
        rewardsIssued,
        rewardsRedeemed,
        activeRewardsCount,
        pendingRequestsCount,
      },
      recentActivity,
    });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN_NOT_BUSINESS_OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Fetch analytics error:", err);
    return NextResponse.json({ error: "Failed to fetch analytics." }, { status: 500 });
  }
}
