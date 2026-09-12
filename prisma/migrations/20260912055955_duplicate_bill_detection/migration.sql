-- AlterTable
ALTER TABLE "VisitRequest" ADD COLUMN     "billImageHash" TEXT,
ADD COLUMN     "billNumber" TEXT,
ADD COLUMN     "duplicateOfRequestId" TEXT,
ADD COLUMN     "duplicateSuspected" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "VisitRequest_businessId_billNumber_idx" ON "VisitRequest"("businessId", "billNumber");

-- CreateIndex
CREATE INDEX "VisitRequest_businessId_billImageHash_idx" ON "VisitRequest"("businessId", "billImageHash");

-- AddForeignKey
ALTER TABLE "VisitRequest" ADD CONSTRAINT "VisitRequest_duplicateOfRequestId_fkey" FOREIGN KEY ("duplicateOfRequestId") REFERENCES "VisitRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

