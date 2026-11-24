BEGIN;
ALTER TYPE "GatheringStatus" ADD VALUE 'CLOSED';
CREATE TABLE "GatheringFeedback" (
  "participantId" TEXT PRIMARY KEY REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "stars" INTEGER NOT NULL CHECK ("stars" BETWEEN 1 AND 5),
  "comment" VARCHAR(1000) NOT NULL DEFAULT '',
  "updatedAt" TIMESTAMP(3) NOT NULL
);
ALTER TABLE "GatheringFeedback" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "GatheringFeedback" FROM PUBLIC;
DO $$ DECLARE client_role text; BEGIN
  FOR client_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
    EXECUTE format('REVOKE ALL ON "GatheringFeedback" FROM %I', client_role);
  END LOOP;
END $$;
-- Serialize last-minute signups/RSVPs with the organizer's status update.
CREATE FUNCTION check_gathering_attendance_open() RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
DECLARE current_status text;
BEGIN
  SELECT "status"::text INTO current_status FROM "Gathering" WHERE id = NEW."gatheringId" FOR SHARE;
  IF current_status = 'CLOSED' THEN RAISE EXCEPTION 'La juntada está cerrada'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION check_gathering_attendance_open() FROM PUBLIC;
CREATE TRIGGER check_attendance_before_write BEFORE INSERT OR UPDATE OF "rsvpStatus","plusOnes" ON "Participant"
FOR EACH ROW EXECUTE FUNCTION check_gathering_attendance_open();
COMMIT;
