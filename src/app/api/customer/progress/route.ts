import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const mobileNumber = searchParams.get("mobileNumber");
    const businessId = searchParams.get("businessId");

    if (!mobileNumber || !businessId) {
      return NextResponse.json({ error: "Missing mobileNumber or businessId" }, { status: 400 });
    }

    const now = new Date();
    // Get the currently active program for this business
    const activeProgram = await prisma.loyaltyProgram.findFirst({
      where: {
        businessId,
        startsAt: { lte: now },
        endsAt: { gte: now },
        endedManuallyAt: null,
      },
      orderBy: { startsAt: "desc" },
    });

    if (!activeProgram) {
      return NextResponse.json({ error: "No active loyalty program found" }, { status: 404 });
    }

    const customer = await prisma.customer.findUnique({
      where: {
        businessId_mobileNumber: {
          businessId,
          mobileNumber,
        },
      },
      include: {
        memberships: {
          where: { businessId },
        },
      },
    });

    if (!customer || customer.memberships.length === 0) {
      return NextResponse.json({
        exists: false,
        totalStamps: 0,
        currentStamps: 0,
        requiredStamps: activeProgram.requiredVisits,
        isCompleted: false,
      });
    }

    const membership = customer.memberships[0];

    // Find the loyalty card for the active program
    const card = await prisma.loyaltyCard.findUnique({
      where: {
        membershipId_loyaltyProgramId: {
          membershipId: membership.id,
          loyaltyProgramId: activeProgram.id
        }
      },
      include: { stamps: true }
    });

    const currentStamps = card ? card.stamps.length : 0;
    const isCompleted = currentStamps >= activeProgram.requiredVisits;

    return NextResponse.json({
      exists: true,
      name: customer.name,
      membershipId: membership.id,
      reviewPromptedAt: membership.reviewPromptedAt,
      totalStamps: membership.totalVisits, // legacy total lifetime visits across all cards
      currentStamps,
      requiredStamps: activeProgram.requiredVisits,
      isCompleted,
    }, { status: 200 });

  } catch (error) {
    console.error("Progress check error:", error);
    return NextResponse.json({ error: "Failed to fetch progress." }, { status: 500 });
  }
}

