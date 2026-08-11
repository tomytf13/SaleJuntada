-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "GatheringStatus" AS ENUM ('DRAFT', 'OPEN', 'PROPOSED', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AvailabilityKind" AS ENUM ('AVAILABLE', 'MAYBE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('SUGGESTED', 'SELECTED', 'REJECTED');

-- CreateTable
CREATE TABLE "Gathering" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "locationHint" TEXT,
    "organizerName" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 180,
    "status" "GatheringStatus" NOT NULL DEFAULT 'OPEN',
    "finalizedStart" TIMESTAMP(3),
    "finalizedEnd" TIMESTAMP(3),
    "finalizedLocation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gathering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "gatheringId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "isOrganizer" BOOLEAN NOT NULL DEFAULT false,
    "responseToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Availability" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "kind" "AvailabilityKind" NOT NULL DEFAULT 'AVAILABLE',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "gatheringId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "availableCount" INTEGER NOT NULL,
    "maybeCount" INTEGER NOT NULL DEFAULT 0,
    "unavailableCount" INTEGER NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION NOT NULL,
    "explanation" TEXT,
    "status" "ProposalStatus" NOT NULL DEFAULT 'SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Gathering_slug_key" ON "Gathering"("slug");

-- CreateIndex
CREATE INDEX "Gathering_status_windowStart_idx" ON "Gathering"("status", "windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_responseToken_key" ON "Participant"("responseToken");

-- CreateIndex
CREATE INDEX "Participant_gatheringId_idx" ON "Participant"("gatheringId");

-- CreateIndex
CREATE INDEX "Availability_startsAt_endsAt_idx" ON "Availability"("startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Availability_participantId_startsAt_endsAt_key" ON "Availability"("participantId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "Proposal_gatheringId_score_idx" ON "Proposal"("gatheringId", "score");

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_gatheringId_fkey" FOREIGN KEY ("gatheringId") REFERENCES "Gathering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_gatheringId_fkey" FOREIGN KEY ("gatheringId") REFERENCES "Gathering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
