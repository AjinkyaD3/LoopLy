import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireOwnerBusiness } from "@/lib/auth";
import { LoyaltyProgramSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { business } = await requireOwnerBusiness();

    if (business.loyaltyProgram) {
      return NextResponse.json({ error: "Loyalty program already configured." }, { status: 409 });
    }

    const body = await request.json();
    const parsed = LoyaltyProgramSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const {
      programName,
      requiredVisits,
      rewardTitle,
      rewardDescription,
      rewardValidityDays,
      verificationMethod,
      isActive,
    } = parsed.data;

    const loyaltyProgram = await prisma.loyaltyProgram.create({
      data: {
        businessId: business.id,
        programName,
        requiredVisits,
        rewardTitle,
        rewardDescription,
        rewardValidityDays,
        verificationMethod,
        isActive,
      },
    });

    return NextResponse.json({ success: true, loyaltyProgram }, { status: 201 });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN_NOT_BUSINESS_OWNER" || error.message === "NO_OWNED_BUSINESS") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Create loyalty program error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { business } = await requireOwnerBusiness();

    if (!business.loyaltyProgram) {
      return NextResponse.json({ error: "No loyalty program configured." }, { status: 404 });
    }

    const body = await request.json();
    const parsed = LoyaltyProgramSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const {
      programName,
      requiredVisits,
      rewardTitle,
      rewardDescription,
      rewardValidityDays,
      verificationMethod,
      isActive,
    } = parsed.data;

    const updated = await prisma.loyaltyProgram.update({
      where: { id: business.loyaltyProgram.id },
      data: {
        programName,
        requiredVisits,
        rewardTitle,
        rewardDescription,
        rewardValidityDays,
        verificationMethod,
        isActive,
      },
    });

    return NextResponse.json({ success: true, loyaltyProgram: updated }, { status: 200 });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN_NOT_BUSINESS_OWNER" || error.message === "NO_OWNED_BUSINESS") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Update loyalty program error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { business } = await requireOwnerBusiness();

    if (!business.loyaltyProgram) {
      return NextResponse.json({ error: "No loyalty program configured." }, { status: 404 });
    }

    // In order to delete a loyalty program, we must use a transaction to safely wipe
    // all associated Memberships for this business. This effectively removes all Visits, 
    // VerificationRequests, and Rewards (which resolves the Restrict constraint).
    await prisma.$transaction([
      prisma.membership.deleteMany({ where: { businessId: business.id } }),
      prisma.loyaltyProgram.delete({ where: { id: business.loyaltyProgram.id } }),
    ]);

    return NextResponse.json({ success: true, message: "Loyalty program deleted successfully" }, { status: 200 });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN_NOT_BUSINESS_OWNER" || error.message === "NO_OWNED_BUSINESS") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Delete loyalty program error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

