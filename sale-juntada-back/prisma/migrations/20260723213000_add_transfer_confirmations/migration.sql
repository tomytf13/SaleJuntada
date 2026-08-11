-- CreateTable
CREATE TABLE "TransferConfirmation" (
    "id" TEXT NOT NULL,
    "gatheringId" TEXT NOT NULL,
    "fromParticipantId" TEXT NOT NULL,
    "toParticipantId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransferConfirmation_gatheringId_fromParticipantId_toParticipantId_amountCents_key" ON "TransferConfirmation"("gatheringId", "fromParticipantId", "toParticipantId", "amountCents");

-- CreateIndex
CREATE INDEX "TransferConfirmation_gatheringId_idx" ON "TransferConfirmation"("gatheringId");

-- AddForeignKey
ALTER TABLE "TransferConfirmation" ADD CONSTRAINT "TransferConfirmation_gatheringId_fkey" FOREIGN KEY ("gatheringId") REFERENCES "Gathering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferConfirmation" ADD CONSTRAINT "TransferConfirmation_fromParticipantId_fkey" FOREIGN KEY ("fromParticipantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferConfirmation" ADD CONSTRAINT "TransferConfirmation_toParticipantId_fkey" FOREIGN KEY ("toParticipantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
