ALTER TABLE "Participant"
ADD COLUMN "authUserId" TEXT;

CREATE INDEX "Participant_authUserId_idx"
ON "Participant"("authUserId");

CREATE UNIQUE INDEX "Participant_gatheringId_authUserId_key"
ON "Participant"("gatheringId", "authUserId");

-- Sale Juntada reads and writes these tables only through NestJS/Prisma.
-- Keeping RLS enabled without public policies prevents browser clients from
-- bypassing the API through Supabase Data API.
ALTER TABLE "Gathering" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Participant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Availability" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Proposal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TransferConfirmation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchasePlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseItem" ENABLE ROW LEVEL SECURITY;
