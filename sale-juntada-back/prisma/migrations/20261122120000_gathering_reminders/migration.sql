BEGIN;
CREATE TABLE "GatheringReminder" (
  "participantId" TEXT NOT NULL REFERENCES "Participant"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "deviceId" TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  "nextCheck" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("participantId", "deviceId")
);
CREATE INDEX "GatheringReminder_nextCheck_idx" ON "GatheringReminder"("nextCheck");
CREATE TABLE "ReminderSigningKey" (id INTEGER PRIMARY KEY, "publicKey" TEXT NOT NULL, "privateKey" TEXT NOT NULL);
ALTER TABLE "GatheringReminder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReminderSigningKey" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "GatheringReminder", "ReminderSigningKey" FROM PUBLIC;
DO $$
DECLARE client_role text;
BEGIN
  FOR client_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
    EXECUTE format('REVOKE ALL ON "GatheringReminder", "ReminderSigningKey" FROM %I', client_role);
  END LOOP;
END $$;
COMMIT;
