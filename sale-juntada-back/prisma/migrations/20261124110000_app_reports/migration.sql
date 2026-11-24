BEGIN;
CREATE TYPE "ReportKind" AS ENUM ('BUG', 'IDEA');
CREATE TYPE "ReportStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED');
CREATE TABLE "AppReport" (
  id UUID PRIMARY KEY,
  kind "ReportKind" NOT NULL,
  description VARCHAR(2000) NOT NULL CHECK (length(trim(description)) BETWEEN 5 AND 2000),
  status "ReportStatus" NOT NULL DEFAULT 'NEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AppReport_status_createdAt_id_idx" ON "AppReport"(status,"createdAt",id);
ALTER TABLE "AppReport" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "AppReport" FROM PUBLIC;
DO $$ DECLARE client_role text; BEGIN
  FOR client_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
    EXECUTE format('REVOKE ALL ON "AppReport" FROM %I', client_role);
  END LOOP;
END $$;
COMMIT;
