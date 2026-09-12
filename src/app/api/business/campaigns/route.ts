import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireOwnerBusiness } from "@/lib/auth";
import { CampaignCreateSchema } from "@/lib/validations";
import { generateToken } from "@/lib/token";
import { getCampaignStatus } from "@/lib/campaign";
import { getCampaignPlayUrl, generateQRCodeSvg } from "@/lib/qr";

export const dynamic = "force-dynamic";

/**
 * POST /api/business/campaigns
 * Creates a new standalone promotional campaign for the owner's business.
 * Independent of the loyalty program — no cap on how many campaigns a business can run.
 */
export async function POST(request: NextRequest) {
  try {
    const { business } = await requireOwnerBusiness();

    const body = await request.json();
    const parsed = CampaignCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const { name, startsAt, endsAt, prizes } = parsed.data;
    const campaignToken = generateToken(12);

    const campaign = await prisma.campaign.create({
      data: {
        businessId: business.id,
        name,
        campaignToken,
        startsAt,
        endsAt: endsAt ?? null,
        prizes: {
          create: prizes.map((p) => ({
            title: p.title,
            weight: p.weight,
            totalStock: p.totalStock,
            remainingStock: p.totalStock,
          })),
        },
      },
      include: { prizes: true },
    });

    return NextResponse.json({ success: true, campaign }, { status: 201 });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN_NOT_BUSINESS_OWNER" || error.message === "NO_OWNED_BUSINESS") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Create campaign error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/business/campaigns
 * Lists all campaigns for the owner's business, each annotated with its computed status,
 * play count, and per-prize remaining/total stock.
 */
export async function GET() {
  try {
    const { business } = await requireOwnerBusiness();

    const campaigns = await prisma.campaign.findMany({
      where: { businessId: business.id },
      include: {
        prizes: true,
        _count: { select: { plays: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = await Promise.all(
      campaigns.map(async (c) => {
        const playUrl = getCampaignPlayUrl(c.campaignToken);
        const qrSvg = await generateQRCodeSvg(playUrl);
        return {
          id: c.id,
          name: c.name,
          campaignToken: c.campaignToken,
          playUrl,
          qrSvg,
          startsAt: c.startsAt,
          endsAt: c.endsAt,
          endedManuallyAt: c.endedManuallyAt,
          status: getCampaignStatus(c, c.prizes),
          playsCount: c._count.plays,
          prizes: c.prizes.map((p) => ({
            id: p.id,
            title: p.title,
            weight: p.weight,
            totalStock: p.totalStock,
            remainingStock: p.remainingStock,
          })),
        };
      })
    );

    return NextResponse.json({ campaigns: formatted });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN_NOT_BUSINESS_OWNER" || msg === "NO_OWNED_BUSINESS") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Fetch campaigns error:", err);
    return NextResponse.json({ error: "Failed to fetch campaigns." }, { status: 500 });
  }
}
