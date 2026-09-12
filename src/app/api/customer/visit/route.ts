import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const visitFieldsSchema = z.object({
  mobileNumber: z.string().min(5),
  enteredName: z.string().optional(),
  businessId: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const parsed = visitFieldsSchema.safeParse({
      mobileNumber: formData.get("mobileNumber"),
      enteredName: formData.get("enteredName") || undefined,
      businessId: formData.get("businessId"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { mobileNumber, enteredName, businessId } = parsed.data;

    const business = await prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      return NextResponse.json({ error: "Business or loyalty program not found" }, { status: 404 });
    }

    // The QR is permanent and public, but it resolves only the business. A scan never
    // grants a loyalty card position. The request is tied to whichever dated program is
    // active right now and must still be approved at the counter.
    const now = new Date();
    const program = await prisma.loyaltyProgram.findFirst({
      where: {
        businessId,
        startsAt: { lte: now },
        endsAt: { gte: now },
        endedManuallyAt: null,
      },
      orderBy: { startsAt: "desc" },
    });
    if (!program) {
      return NextResponse.json({ error: "There is no active loyalty program for this business." }, { status: 409 });
    }

    if (!program.isActive) {
      return NextResponse.json({ error: "This loyalty program is currently paused and not accepting new visits." }, { status: 409 });
    }

    const pendingRequestToday = await prisma.visitRequest.findFirst({
      where: {
        businessId,
        customer: { mobileNumber },
        status: "PENDING",
      },
    });

    if (pendingRequestToday) {
      return NextResponse.json(
        { error: "You already have a pending loyalty-card request. Please wait for the business to approve or reject it." },
        { status: 429 }
      );
    }

    // Upsert Customer
    const customer = await prisma.customer.upsert({
      where: {
        businessId_mobileNumber: {
          businessId,
          mobileNumber,
        },
      },
      update: {
        name: enteredName || undefined,
      },
      create: {
        businessId,
        mobileNumber,
        name: enteredName,
      },
    });

    // Upsert Membership
    const membership = await prisma.membership.upsert({
      where: {
        customerId_businessId: {
          customerId: customer.id,
          businessId,
        },
      },
      update: {},
      create: {
        customerId: customer.id,
        businessId,
        totalVisits: 0,
      },
    });

    // Verify they haven't already completed this program
    const card = await prisma.loyaltyCard.findUnique({
      where: {
        membershipId_loyaltyProgramId: {
          membershipId: membership.id,
          loyaltyProgramId: program.id,
        },
      },
      include: { _count: { select: { stamps: true } } },
    });

    if (card && card._count.stamps >= program.requiredVisits) {
      return NextResponse.json(
        { error: "You have already completed this loyalty program and cannot request more stamps." },
        { status: 409 }
      );
    }

    // Create a pending counter-confirmation request. No bill upload or loyalty card
    // position is issued until the owner/cashier approves it.
    const visitRequest = await prisma.visitRequest.create({
      data: {
        membershipId: membership.id,
        businessId,
        customerId: customer.id,
        loyaltyProgramId: program.id,
        enteredName,
        method: "VISIT_CONFIRMATION",
        status: "PENDING",
      },
    });

    return NextResponse.json({ success: true, visitRequest }, { status: 201 });
  } catch (error) {
    console.error("Submit visit error:", error);
    return NextResponse.json({ error: "Failed to submit visit request." }, { status: 500 });
  }
}
