-- P1.1 — RSVP.
--
-- El RSVP vive en `Participant` y no en una tabla propia: sería 1:1 con la
-- misma clave y el mismo ciclo de vida, y agregaría un join en `getBySlug`,
-- la consulta que corre en cada apertura del link.

-- RSVP ------------------------------------------------------------------
CREATE TYPE "RsvpStatus" AS ENUM ('GOING', 'MAYBE', 'NOT_GOING');

ALTER TABLE "Participant" ADD COLUMN "rsvpStatus" "RsvpStatus";
ALTER TABLE "Participant" ADD COLUMN "plusOnes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Participant" ADD COLUMN "rsvpAt" TIMESTAMP(3);

-- Sirve al agrupado por estado del resumen de asistencia.
CREATE INDEX "Participant_gatheringId_rsvpStatus_idx"
ON "Participant"("gatheringId", "rsvpStatus");

-- Sin backfill a GOING a propósito. El RSVP sólo aplica cuando la juntada
-- tiene fecha confirmada, así que marcar a los organizadores existentes
-- como GOING inventaría respuestas para juntadas que todavía están
-- buscando día. El estado inicial correcto es el de los defaults:
-- rsvpStatus = NULL, plusOnes = 0, rsvpAt = NULL. El seed crea los
-- ejemplos explícitos de cada caso.

-- Poda de GatheringStatus -----------------------------------------------
-- DRAFT y PROPOSED nunca se escribieron ni se leyeron en ninguna parte del
-- backend, el frontend, los tests o el seed. Postgres no permite quitar
-- valores de un enum, así que se recrea el tipo.
--
-- El USING falla ruidosamente si quedara alguna fila con los valores
-- viejos, que es el comportamiento buscado: mejor un error que una
-- conversión silenciosa.
ALTER TABLE "Gathering" ALTER COLUMN "status" DROP DEFAULT;

ALTER TYPE "GatheringStatus" RENAME TO "GatheringStatus_old";

CREATE TYPE "GatheringStatus" AS ENUM ('OPEN', 'CONFIRMED', 'CANCELLED');

ALTER TABLE "Gathering"
  ALTER COLUMN "status" TYPE "GatheringStatus"
  USING ("status"::text::"GatheringStatus");

ALTER TABLE "Gathering" ALTER COLUMN "status" SET DEFAULT 'OPEN';

DROP TYPE "GatheringStatus_old";
