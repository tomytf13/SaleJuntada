-- CreateEnum
CREATE TYPE "PurchaseCategory" AS ENUM ('FOOD', 'DRINKS', 'OTHER', 'ALCOHOL');

-- CreateTable
CREATE TABLE "PurchasePlan" (
    "id" TEXT NOT NULL,
    "gatheringId" TEXT NOT NULL,
    "includeAlcohol" BOOLEAN NOT NULL DEFAULT false,
    "ageConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "participantBaseline" INTEGER NOT NULL DEFAULT 1,
    "updatedByParticipantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchasePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseItem" (
    "id" TEXT NOT NULL,
    "purchasePlanId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "category" "PurchaseCategory" NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchasePlan_gatheringId_key" ON "PurchasePlan"("gatheringId");

-- CreateIndex
CREATE INDEX "PurchasePlan_updatedByParticipantId_idx" ON "PurchasePlan"("updatedByParticipantId");

-- CreateIndex
CREATE INDEX "PurchaseItem_purchasePlanId_position_idx" ON "PurchaseItem"("purchasePlanId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseItem_purchasePlanId_key_key" ON "PurchaseItem"("purchasePlanId", "key");

-- AddForeignKey
ALTER TABLE "PurchasePlan" ADD CONSTRAINT "PurchasePlan_gatheringId_fkey" FOREIGN KEY ("gatheringId") REFERENCES "Gathering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasePlan" ADD CONSTRAINT "PurchasePlan_updatedByParticipantId_fkey" FOREIGN KEY ("updatedByParticipantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_purchasePlanId_fkey" FOREIGN KEY ("purchasePlanId") REFERENCES "PurchasePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep new public-schema tables closed to Supabase's Data API.
-- The NestJS/Prisma backend remains the only application entry point.
ALTER TABLE "PurchasePlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseItem" ENABLE ROW LEVEL SECURITY;

-- RenameIndex
ALTER INDEX "TransferConfirmation_gatheringId_fromParticipantId_toParticipan" RENAME TO "TransferConfirmation_gatheringId_fromParticipantId_toPartic_key";
