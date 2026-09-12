-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "campaignToken" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "endedManuallyAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignPrize" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "totalStock" INTEGER NOT NULL,
    "remainingStock" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignPrize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignPlay" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "mobileNumber" TEXT NOT NULL,
    "customerName" TEXT,
    "wonPrizeId" TEXT,
    "revealedPrize" TEXT NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignPlay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_campaignToken_key" ON "Campaign"("campaignToken");

-- CreateIndex
CREATE INDEX "Campaign_businessId_idx" ON "Campaign"("businessId");

-- CreateIndex
CREATE INDEX "Campaign_campaignToken_idx" ON "Campaign"("campaignToken");

-- CreateIndex
CREATE INDEX "CampaignPrize_campaignId_idx" ON "CampaignPrize"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignPlay_campaignId_idx" ON "CampaignPlay"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignPlay_campaignId_mobileNumber_key" ON "CampaignPlay"("campaignId", "mobileNumber");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignPrize" ADD CONSTRAINT "CampaignPrize_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignPlay" ADD CONSTRAINT "CampaignPlay_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignPlay" ADD CONSTRAINT "CampaignPlay_wonPrizeId_fkey" FOREIGN KEY ("wonPrizeId") REFERENCES "CampaignPrize"("id") ON DELETE SET NULL ON UPDATE CASCADE;

