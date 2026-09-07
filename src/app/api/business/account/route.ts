import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireOwnerBusiness, invalidateSession } from "@/lib/auth";
import { BusinessUpdateSchema } from "@/lib/validations";
import { cookies } from "next/headers";

export async function PUT(req: Request) {
  try {
    const { owner, business } = await requireOwnerBusiness();
    const body = await req.json();

    const data = BusinessUpdateSchema.parse(body);

    const updatedBusiness = await prisma.business.update({
      where: { id: business.id },
      data: {
        name: data.name,
        googleReviewUrl: data.googleReviewUrl || null,
        instagramHandle: data.instagramHandle || null,
      },
    });

    return NextResponse.json({
      success: true,
      business: {
        id: updatedBusiness.id,
        name: updatedBusiness.name,
      },
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    if (
      error.message === "UNAUTHORIZED" ||
      error.message === "FORBIDDEN_NOT_BUSINESS_OWNER" ||
      error.message === "NO_OWNED_BUSINESS"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Business update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { owner } = await requireOwnerBusiness();

    // The Prisma schema handles cascading deletes for User -> Business -> LoyaltyProgram, Memberships, Visits, VerificationRequests, and Rewards.
    await prisma.user.delete({
      where: { id: owner.id },
    });

    // We invalidate the session manually just in case, and clear the cookie
    const cookieStore = cookies();
    const token = cookieStore.get("looply_session")?.value;
    if (token) {
      await invalidateSession(token);
      cookieStore.delete("looply_session");
    }

    return NextResponse.json({ success: true, message: "Account deleted successfully" });
  } catch (error: any) {
    if (
      error.message === "UNAUTHORIZED" ||
      error.message === "FORBIDDEN_NOT_BUSINESS_OWNER" ||
      error.message === "NO_OWNED_BUSINESS"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Account deletion error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
