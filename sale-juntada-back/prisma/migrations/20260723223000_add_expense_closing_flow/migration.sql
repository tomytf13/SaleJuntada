-- AlterTable
ALTER TABLE "Gathering" ADD COLUMN "expenseRound" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Participant" ADD COLUMN "expensesReadyAt" TIMESTAMP(3);
