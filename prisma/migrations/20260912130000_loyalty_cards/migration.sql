-- Loyalty cards replace lifetime/rolling/fixed counters. The business QR remains
-- permanent; multiple dated programs can now belong to the same business.

DROP INDEX IF EXISTS "LoyaltyProgram_businessId_key";

ALTER TABLE "LoyaltyProgram"
  ADD COLUMN "startsAt" TIMESTAMP(3),
  ADD COLUMN "endsAt" TIMESTAMP(3),
  ADD COLUMN "endedManuallyAt" TIMESTAMP(3);

-- Preserve existing programs as a short, already-bounded historical program. New
-- programs always provide their own dates through the application validation.
UPDATE "LoyaltyProgram"
SET "startsAt" = COALESCE("createdAt", CURRENT_TIMESTAMP),
    "endsAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP) + INTERVAL '30 days'
WHERE "startsAt" IS NULL OR "endsAt" IS NULL;

ALTER TABLE "LoyaltyProgram"
  ALTER COLUMN "startsAt" SET NOT NULL,
  ALTER COLUMN "endsAt" SET NOT NULL;

-- Keep legacy counter configuration columns for a safe staged UI migration. New card
-- programs do not use them.
ALTER TABLE "Business" ADD COLUMN "loyaltyProgramId" TEXT;
UPDATE "Business" AS b SET "loyaltyProgramId" = p."id"
FROM "LoyaltyProgram" AS p WHERE p."businessId" = b."id";
CREATE UNIQUE INDEX "Business_loyaltyProgramId_key" ON "Business"("loyaltyProgramId");
ALTER TABLE "Business" ADD CONSTRAINT "Business_loyaltyProgramId_fkey"
  FOREIGN KEY ("loyaltyProgramId") REFERENCES "LoyaltyProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "LoyaltyRewardDefinition" (
  "id" TEXT NOT NULL,
  "loyaltyProgramId" TEXT NOT NULL,
  "cardPosition" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LoyaltyRewardDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoyaltyCard" (
  "id" TEXT NOT NULL,
  "membershipId" TEXT NOT NULL,
  "loyaltyProgramId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LoyaltyCard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoyaltyCardStamp" (
  "id" TEXT NOT NULL,
  "loyaltyCardId" TEXT NOT NULL,
  "visitRequestId" TEXT NOT NULL,
  "cardPosition" INTEGER NOT NULL,
  "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoyaltyCardStamp_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "VisitRequest" ADD COLUMN "loyaltyProgramId" TEXT;
ALTER TABLE "Reward" ADD COLUMN "loyaltyCardId" TEXT;
ALTER TABLE "Reward" ADD COLUMN "loyaltyRewardDefinitionId" TEXT;

CREATE UNIQUE INDEX "LoyaltyRewardDefinition_loyaltyProgramId_cardPosition_key"
  ON "LoyaltyRewardDefinition"("loyaltyProgramId", "cardPosition");
CREATE INDEX "LoyaltyRewardDefinition_loyaltyProgramId_idx"
  ON "LoyaltyRewardDefinition"("loyaltyProgramId");
CREATE UNIQUE INDEX "LoyaltyCard_membershipId_loyaltyProgramId_key"
  ON "LoyaltyCard"("membershipId", "loyaltyProgramId");
CREATE INDEX "LoyaltyCard_loyaltyProgramId_idx" ON "LoyaltyCard"("loyaltyProgramId");
CREATE UNIQUE INDEX "LoyaltyCardStamp_visitRequestId_key" ON "LoyaltyCardStamp"("visitRequestId");
CREATE UNIQUE INDEX "LoyaltyCardStamp_loyaltyCardId_cardPosition_key"
  ON "LoyaltyCardStamp"("loyaltyCardId", "cardPosition");
CREATE INDEX "LoyaltyCardStamp_loyaltyCardId_idx" ON "LoyaltyCardStamp"("loyaltyCardId");
CREATE INDEX "VisitRequest_loyaltyProgramId_idx" ON "VisitRequest"("loyaltyProgramId");
CREATE INDEX "Reward_loyaltyCardId_idx" ON "Reward"("loyaltyCardId");
CREATE INDEX "Reward_loyaltyRewardDefinitionId_idx" ON "Reward"("loyaltyRewardDefinitionId");

ALTER TABLE "LoyaltyRewardDefinition"
  ADD CONSTRAINT "LoyaltyRewardDefinition_loyaltyProgramId_fkey"
  FOREIGN KEY ("loyaltyProgramId") REFERENCES "LoyaltyProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoyaltyCard"
  ADD CONSTRAINT "LoyaltyCard_membershipId_fkey"
  FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "LoyaltyCard_loyaltyProgramId_fkey"
  FOREIGN KEY ("loyaltyProgramId") REFERENCES "LoyaltyProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoyaltyCardStamp"
  ADD CONSTRAINT "LoyaltyCardStamp_loyaltyCardId_fkey"
  FOREIGN KEY ("loyaltyCardId") REFERENCES "LoyaltyCard"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "LoyaltyCardStamp_visitRequestId_fkey"
  FOREIGN KEY ("visitRequestId") REFERENCES "VisitRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisitRequest"
  ADD CONSTRAINT "VisitRequest_loyaltyProgramId_fkey"
  FOREIGN KEY ("loyaltyProgramId") REFERENCES "LoyaltyProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reward"
  ADD CONSTRAINT "Reward_loyaltyCardId_fkey"
  FOREIGN KEY ("loyaltyCardId") REFERENCES "LoyaltyCard"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Reward_loyaltyRewardDefinitionId_fkey"
  FOREIGN KEY ("loyaltyRewardDefinitionId") REFERENCES "LoyaltyRewardDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
