ALTER TABLE "Participant"
ADD COLUMN "avatarUrl" TEXT,
ADD COLUMN "googleSubject" TEXT;

CREATE UNIQUE INDEX "Participant_gatheringId_googleSubject_key"
ON "Participant"("gatheringId", "googleSubject");
