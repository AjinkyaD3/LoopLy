import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireCustomer } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/customer/membership/[membershipId]
 * Returns full membership detail scoped to the authenticated customer.
 *
 * Security:
 * - membership.customerId === authenticatedUser.id — hard check, not just session.
 * - No cross-customer access possible.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  try {
    const user = await requireCustomer();
    const { membershipId } = await params;

    const membership = await prisma.membership.findUnique({
      where: { id: membershipId },
      include: {
        business: { include: { loyaltyProgram: true } },
        verificationRequests: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        visits: {
          orderBy: { visitedAt: "desc" },
          take: 10,
        },
        rewards: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    // Tenant check: must belong to this customer
    if (!membership || membership.customerId !== user.id) {
      return NextResponse.json({ error: "Membership not found." }, { status: 404 });
    }

    // Derive expired status for rewards in-memory (no schema change needed)
    const now = new Date();
    const rewards = membership.rewards.map((r) => ({
      ...r,
      status: r.status === "AVAILABLE" && r.expiresAt <= now ? "EXPIRED" : r.status,
    }));

    return NextResponse.json({
      membership: {
        id: membership.id,
        currentVisits: membership.currentVisits,
        totalVisits: membership.totalVisits,
        joinedAt: membership.joinedAt,
        business: {
          id: membership.business.id,
          name: membership.business.name,
          businessToken: membership.business.businessToken,
        },
        loyaltyProgram: membership.business.loyaltyProgram,
        verificationRequests: membership.verificationRequests,
        visits: membership.visits,
        rewards,
      },
    });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN_NOT_CUSTOMER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Fetch membership error:", err);
    return NextResponse.json({ error: "Failed to fetch membership." }, { status: 500 });
  }
}
