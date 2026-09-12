import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { uploadBillImage } from "@/lib/storage";
import { computeBillImageHash, isNearDuplicateHash } from "@/lib/billHash";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const DUPLICATE_SEARCH_WINDOW_DAYS = 90;

const visitFieldsSchema = z.object({
  mobileNumber: z.string().min(5),
  enteredName: z.string().optional(),
  businessId: z.string(),
  billNumber: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const parsed = visitFieldsSchema.safeParse({
      mobileNumber: formData.get("mobileNumber"),
      enteredName: formData.get("enteredName") || undefined,
      businessId: formData.get("businessId"),
      billNumber: formData.get("billNumber") || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { mobileNumber, enteredName, businessId, billNumber } = parsed.data;
    const billPhoto = formData.get("billPhoto");

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { loyaltyProgram: true },
    });

    if (!business || !business.loyaltyProgram) {
      return NextResponse.json({ error: "Business or loyalty program not found" }, { status: 404 });
    }

    const program = business.loyaltyProgram;

    // Server-side validation for the BILL method — the client-side check in
    // BillPhotoInput is a UX nicety, not the security boundary.
    let billBuffer: Buffer | null = null;
    let billContentType: string | null = null;
    let billImageHash: string | null = null;

    if (program.verificationMethod === "BILL") {
      if (!(billPhoto instanceof File) || billPhoto.size === 0) {
        return NextResponse.json({ error: "Bill photo is required for this program." }, { status: 400 });
      }
      if (!ALLOWED_TYPES.includes(billPhoto.type)) {
        return NextResponse.json({ error: "Only JPG, PNG, and WEBP images are accepted." }, { status: 400 });
      }
      if (billPhoto.size > MAX_BYTES) {
        return NextResponse.json({ error: "Bill photo must be under 5 MB." }, { status: 400 });
      }
      if (!billNumber || billNumber.trim().length === 0) {
        return NextResponse.json({ error: "Bill number is required for this program." }, { status: 400 });
      }
      billBuffer = Buffer.from(await billPhoto.arrayBuffer());
      billContentType = billPhoto.type;
      // Compute the hash from the in-memory buffer before ever uploading — no point paying
      // for a Supabase upload of an image we might reject or that we're about to flag anyway.
      billImageHash = await computeBillImageHash(billBuffer);
    }

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

    // Duplicate-bill pre-check (soft flag, not a rejection — the owner is the final
    // arbiter). Scoped to the last 90 days for this business so the query stays bounded as
    // data grows.
    let duplicateOfRequestId: string | null = null;
    if (billNumber || billImageHash) {
      const windowStart = new Date(Date.now() - DUPLICATE_SEARCH_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const candidates = await prisma.visitRequest.findMany({
        where: {
          businessId,
          createdAt: { gte: windowStart },
          OR: [
            billNumber ? { billNumber } : undefined,
            billImageHash ? { billImageHash: { not: null } } : undefined,
          ].filter(Boolean) as any,
        },
        select: { id: true, billNumber: true, billImageHash: true },
      });

      const exactBillNumberMatch = billNumber ? candidates.find((c) => c.billNumber === billNumber) : undefined;
      const nearImageMatch = billImageHash
        ? candidates.find((c) => c.billImageHash && isNearDuplicateHash(c.billImageHash, billImageHash!))
        : undefined;

      duplicateOfRequestId = exactBillNumberMatch?.id ?? nearImageMatch?.id ?? null;
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

    // Upload the bill now that we have a customer id to scope the storage path under.
    // Uploaded regardless of the duplicate flag — the owner needs to actually see the image
    // to make a judgment call, per "the owner is the final arbiter."
    let billImagePath: string | null = null;
    if (billBuffer && billContentType) {
      const ext = EXT_BY_TYPE[billContentType] || "jpg";
      const storagePath = `${businessId}/${customer.id}/${randomUUID()}.${ext}`;
      const uploadResult = await uploadBillImage(storagePath, billBuffer, billContentType);
      billImagePath = uploadResult.storagePath;
    }

    // Create VisitRequest
    const visitRequest = await prisma.visitRequest.create({
      data: {
        membershipId: membership.id,
        businessId,
        customerId: customer.id,
        enteredName,
        method: program.verificationMethod,
        billImagePath,
        billNumber: billNumber || null,
        billImageHash,
        duplicateSuspected: duplicateOfRequestId !== null,
        duplicateOfRequestId,
        status: "PENDING",
      },
    });

    return NextResponse.json({ success: true, visitRequest }, { status: 201 });
  } catch (error) {
    console.error("Submit visit error:", error);
    return NextResponse.json({ error: "Failed to submit visit request." }, { status: 500 });
  }
}
