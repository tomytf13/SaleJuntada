BEGIN;
ALTER TABLE "Participant" ADD COLUMN "accountDeletedAt" TIMESTAMP(3);
ALTER TABLE "Gathering" ADD COLUMN "expenseShares" JSONB,
 ADD COLUMN "inviteOpenedAt" TIMESTAMP(3),
 ADD COLUMN "inviteIdentifiedAt" TIMESTAMP(3),
 ADD COLUMN "inviteRespondedAt" TIMESTAMP(3);
-- Preserve the distribution of rounds already in progress at rollout.
UPDATE "Gathering" g SET "expenseShares" = (
 SELECT jsonb_object_agg(p.id, 1) FROM "Participant" p WHERE p."gatheringId" = g.id
) WHERE EXISTS (SELECT 1 FROM "Expense" e WHERE e."gatheringId" = g.id)
 OR EXISTS (SELECT 1 FROM "TransferConfirmation" t WHERE t."gatheringId" = g.id)
 OR EXISTS (SELECT 1 FROM "Participant" p WHERE p."gatheringId" = g.id AND p."expensesReadyAt" IS NOT NULL);

-- A first response stays counted if the participant later changes their answer.
CREATE FUNCTION record_guest_response() RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
DECLARE group_id text;
BEGIN
 IF TG_TABLE_NAME = 'Availability' THEN
   SELECT "gatheringId" INTO group_id FROM "Participant" WHERE id = NEW."participantId"
     AND NOT "isOrganizer" AND "authUserId" IS NOT NULL;
 ELSIF NOT NEW."isOrganizer" AND NEW."authUserId" IS NOT NULL AND NEW."rsvpAt" IS NOT NULL THEN
   group_id := NEW."gatheringId";
 END IF;
 UPDATE "Gathering" SET "inviteRespondedAt" = CURRENT_TIMESTAMP,
   "inviteOpenedAt" = COALESCE("inviteOpenedAt", CURRENT_TIMESTAMP),
   "inviteIdentifiedAt" = COALESCE("inviteIdentifiedAt", CURRENT_TIMESTAMP)
 WHERE id = group_id AND "inviteRespondedAt" IS NULL;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION record_guest_response() FROM PUBLIC;
CREATE TRIGGER participant_first_response AFTER INSERT OR UPDATE OF "rsvpAt" ON "Participant"
FOR EACH ROW EXECUTE FUNCTION record_guest_response();
CREATE TRIGGER availability_first_response AFTER INSERT ON "Availability"
FOR EACH ROW EXECUTE FUNCTION record_guest_response();
COMMIT;
