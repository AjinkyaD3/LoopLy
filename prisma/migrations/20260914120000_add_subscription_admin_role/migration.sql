-- Manual subscription gating: new ADMIN role on User and a Subscription table that is
-- activated/deactivated by hand via the internal /admin panel. Payment-gateway automation
-- is future work; the schema is shaped so an automatic activation flow can be added later
-- without a rework.

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('BUSINESS_OWNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('INACTIVE', 'ACTIVE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'BUSINESS_OWNER';

-- CreateTable
CREATE TABLE "Subscription" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
  "activatedAt" TIMESTAMP(3),
  "activatedById" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_businessId_key" ON "Subscription"("businessId");

-- CreateIndex
CREATE INDEX "Subscription_businessId_idx" ON "Subscription"("businessId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_activatedById_fkey"
  FOREIGN KEY ("activatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
