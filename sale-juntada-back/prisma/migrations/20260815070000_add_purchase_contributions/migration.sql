CREATE TABLE "PurchaseContribution" (
    "id" TEXT NOT NULL,
    "purchaseItemId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'unidad',
    "note" TEXT,
    "isReady" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PurchaseContribution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PurchaseContribution_purchaseItemId_participantId_key"
ON "PurchaseContribution"("purchaseItemId", "participantId");

CREATE INDEX "PurchaseContribution_purchaseItemId_updatedAt_idx"
ON "PurchaseContribution"("purchaseItemId", "updatedAt");

CREATE INDEX "PurchaseContribution_participantId_idx"
ON "PurchaseContribution"("participantId");

ALTER TABLE "PurchaseContribution"
ADD CONSTRAINT "PurchaseContribution_purchaseItemId_fkey"
FOREIGN KEY ("purchaseItemId") REFERENCES "PurchaseItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PurchaseContribution"
ADD CONSTRAINT "PurchaseContribution_participantId_fkey"
FOREIGN KEY ("participantId") REFERENCES "Participant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PurchaseContribution" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "PurchaseContribution" FROM anon, authenticated;
