import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== UserRole.CUSTOMER) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { membershipId } = await params;
    
    // Update the reviewPromptedAt timestamp
    await prisma.membership.update({
      where: { id: membershipId, customerId: user.id },
      data: { reviewPromptedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Review prompt error:", error);
    return NextResponse.json(
      { error: "Failed to update membership." },
      { status: 500 }
    );
  }
}
