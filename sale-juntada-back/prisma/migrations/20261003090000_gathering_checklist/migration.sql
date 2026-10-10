CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "gatheringId" TEXT NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "assignedParticipantId" TEXT,
    "isReady" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ChecklistItem_gatheringId_createdAt_idx" ON "ChecklistItem"("gatheringId", "createdAt");
CREATE INDEX "ChecklistItem_assignedParticipantId_idx" ON "ChecklistItem"("assignedParticipantId");
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_gatheringId_fkey" FOREIGN KEY ("gatheringId") REFERENCES "Gathering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_assignedParticipantId_fkey" FOREIGN KEY ("assignedParticipantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
