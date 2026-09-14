import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/businesses
 * Lists every business with its owner and subscription status, for the internal admin panel.
 * A business with no Subscription row is reported as INACTIVE (LEFT JOIN semantics), never omitted.
 */
export async function GET() {
  try {
    await requireAdmin();

    const businesses = await prisma.business.findMany({
      include: {
        owner: { select: { name: true, email: true } },
        subscription: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = businesses.map((b) => ({
      id: b.id,
      name: b.name,
      businessToken: b.businessToken,
      createdAt: b.createdAt,
      owner: { name: b.owner.name, email: b.owner.email },
      subscriptionStatus: b.subscription?.status ?? "INACTIVE",
      activatedAt: b.subscription?.activatedAt ?? null,
      notes: b.subscription?.notes ?? null,
    }));

    return NextResponse.json({ businesses: formatted });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin list businesses error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
