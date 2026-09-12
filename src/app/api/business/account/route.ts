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

    // Partial-update semantics: a field omitted from the request (undefined) leaves the
    // existing value unchanged; a field explicitly sent (including "") is written. This is
    // what lets the dashboard's quick-rename form send only {name} without wiping the other
    // five fields — Prisma skips any key whose value is undefined in an update.
    const updatedBusiness = await prisma.business.update({
      where: { id: business.id },
      data: {
        name: data.name,
        address: data.address !== undefined ? (data.address || null) : undefined,
        businessType: data.businessType !== undefined ? (data.businessType || null) : undefined,
        googleReviewUrl: data.googleReviewUrl !== undefined ? (data.googleReviewUrl || null) : undefined,
        instagramHandle: data.instagramHandle !== undefined ? (data.instagramHandle || null) : undefined,
        youtubeHandle: data.youtubeHandle !== undefined ? (data.youtubeHandle || null) : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      business: {
        id: updatedBusiness.id,
        name: updatedBusiness.name,
        address: updatedBusiness.address,
        businessType: updatedBusiness.businessType,
        googleReviewUrl: updatedBusiness.googleReviewUrl,
        instagramHandle: updatedBusiness.instagramHandle,
        youtubeHandle: updatedBusiness.youtubeHandle,
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
