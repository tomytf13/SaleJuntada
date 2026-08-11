-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "gatheringId" TEXT NOT NULL,
    "paidByParticipantId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_gatheringId_createdAt_idx" ON "Expense"("gatheringId", "createdAt");

-- CreateIndex
CREATE INDEX "Expense_paidByParticipantId_idx" ON "Expense"("paidByParticipantId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_gatheringId_fkey" FOREIGN KEY ("gatheringId") REFERENCES "Gathering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paidByParticipantId_fkey" FOREIGN KEY ("paidByParticipantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
