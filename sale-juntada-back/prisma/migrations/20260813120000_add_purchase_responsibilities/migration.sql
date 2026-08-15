ALTER TABLE "PurchaseItem"
ADD COLUMN "assignedParticipantId" TEXT,
ADD COLUMN "assignedAt" TIMESTAMP(3),
ADD COLUMN "isReady" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "PurchaseItem_assignedParticipantId_idx"
ON "PurchaseItem"("assignedParticipantId");

ALTER TABLE "PurchaseItem"
ADD CONSTRAINT "PurchaseItem_assignedParticipantId_fkey"
FOREIGN KEY ("assignedParticipantId") REFERENCES "Participant"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- This table is only accessed by the NestJS backend connection. No public
-- PostgREST policy is created, so browser clients cannot bypass the API.
ALTER TABLE "PurchaseItem" ENABLE ROW LEVEL SECURITY;
