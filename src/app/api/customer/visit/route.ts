import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const visitSchema = z.object({
  mobileNumber: z.string().min(5),
  enteredName: z.string().optional(),
  billPhotoUrl: z.string().optional(),
  businessId: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = visitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { mobileNumber, enteredName, billPhotoUrl, businessId } = parsed.data;

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { loyaltyProgram: true },
    });

    if (!business || !business.loyaltyProgram) {
      return NextResponse.json({ error: "Business or loyalty program not found" }, { status: 404 });
    }

    const program = business.loyaltyProgram;

    // Abuse Guard: Check for pending requests today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const pendingRequestToday = await prisma.visitRequest.findFirst({
      where: {
        businessId,
        customer: { mobileNumber },
        status: "PENDING",
        createdAt: { gte: startOfDay },
      },
    });

    if (pendingRequestToday) {
      return NextResponse.json(
        { error: "You already have a pending visit request today. Please wait for the business to approve it." },
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

    // Create VisitRequest
    const visitRequest = await prisma.visitRequest.create({
      data: {
        membershipId: membership.id,
        businessId,
        customerId: customer.id,
        enteredName,
        method: program.verificationMethod,
        billImagePath: billPhotoUrl,
        status: "PENDING",
      },
    });

    return NextResponse.json({ success: true, visitRequest }, { status: 201 });
  } catch (error) {
    console.error("Submit visit error:", error);
    return NextResponse.json({ error: "Failed to submit visit request." }, { status: 500 });
  }
}
