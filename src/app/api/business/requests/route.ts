import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/business/requests
 * Returns verification requests belonging to the authenticated owner's business.
 * A request is only an approval queue entry; card positions are awarded atomically
 * by the approval route, never by a QR scan or request submission.
 *
 * Security:
 *   - Business resolved via ownerId === user.id — never from client.
 */
export async function GET(request: Request) {
  try {
    const user = await requireBusinessOwner();

    const business = await prisma.business.findUnique({ where: { ownerId: user.id } });

    if (!business) {
      return NextResponse.json({ error: "No business found for this owner." }, { status: 404 });
    }

    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");
    const validStatuses = ["PENDING", "APPROVED", "REJECTED"];
    const status = validStatuses.includes(statusParam ?? "") ? statusParam! : "PENDING";

    const requests = await prisma.visitRequest.findMany({
      where: {
        businessId: business.id,
        status: status as "PENDING" | "APPROVED" | "REJECTED",
      },
      include: {
        customer: { select: { id: true, name: true, mobileNumber: true } },
        membership: { select: { id: true, totalVisits: true } },
        visit: { select: { id: true, visitedAt: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const enrichedRequests = await Promise.all(
      requests.map(async (r) => {
        const issuedCardPositions = r.loyaltyProgramId
          ? await prisma.loyaltyCardStamp.count({
              where: { loyaltyCard: { membershipId: r.membership.id, loyaltyProgramId: r.loyaltyProgramId } },
            })
          : 0;
        return {
          ...r,
          membership: { ...r.membership, currentVisits: issuedCardPositions },
        };
      })
    );

    return NextResponse.json({ requests: enrichedRequests, businessName: business.name });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN_NOT_BUSINESS_OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Fetch business requests error:", err);
    return NextResponse.json({ error: "Failed to fetch verification requests." }, { status: 500 });
  }
}
