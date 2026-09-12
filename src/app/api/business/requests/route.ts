import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessOwner } from "@/lib/auth";
import { getBillViewUrl } from "@/lib/storage";
import { computeThresholdEligibility } from "@/lib/loyaltyProgress";

export const dynamic = "force-dynamic";

/**
 * GET /api/business/requests
 * Returns verification requests belonging to the authenticated owner's business.
 * Resolves bill preview URL via getBillViewUrl (Supabase signed URL or local URL).
 *
 * Security:
 *   - Business resolved via ownerId === user.id — never from client.
 */
export async function GET(request: Request) {
  try {
    const user = await requireBusinessOwner();

    const business = await prisma.business.findUnique({
      where: { ownerId: user.id },
      include: { loyaltyProgram: true },
    });

    if (!business || !business.loyaltyProgram) {
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
        const signedBillUrl = r.billImagePath ? await getBillViewUrl(r.billImagePath) : null;
        const eligibility = await computeThresholdEligibility(prisma, r.membership.id, business.loyaltyProgram!);
        return {
          ...r,
          membership: { ...r.membership, currentVisits: eligibility.qualifyingVisits },
          signedBillUrl,
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
