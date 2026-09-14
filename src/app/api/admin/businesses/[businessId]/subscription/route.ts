import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { SubscriptionUpdateSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

/**
 * PUT /api/admin/businesses/[businessId]/subscription
 * Manually activates/deactivates a business's subscription. Payment-gateway automation is
 * future work — this is the only activation path today.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { businessId: string } }
) {
  try {
    const admin = await requireAdmin();
    const { businessId } = params;

    const body = await request.json();
    const parsed = SubscriptionUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    const { status, notes } = parsed.data;

    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }

    const subscription = await prisma.subscription.upsert({
      where: { businessId },
      create: {
        businessId,
        status,
        notes: notes ?? null,
        ...(status === "ACTIVE" ? { activatedAt: new Date(), activatedById: admin.id } : {}),
      },
      update: {
        status,
        notes: notes ?? undefined,
        // Only stamp activation audit fields when transitioning to ACTIVE — leave them
        // untouched on deactivation so we keep a record of who last activated it.
        ...(status === "ACTIVE" ? { activatedAt: new Date(), activatedById: admin.id } : {}),
      },
    });

    return NextResponse.json({ success: true, subscription });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin update subscription error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
