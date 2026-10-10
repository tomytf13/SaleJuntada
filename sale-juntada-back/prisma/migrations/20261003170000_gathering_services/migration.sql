CREATE TYPE "GatheringServiceKey" AS ENUM ('compra', 'pendientes', 'alimentacion', 'cuentas', 'juegos');

-- Las juntadas existentes conservan todas sus herramientas y sus datos.
ALTER TABLE "Gathering"
  ADD COLUMN "disabledServices" "GatheringServiceKey"[] NOT NULL DEFAULT ARRAY[]::"GatheringServiceKey"[],
  ADD COLUMN "archivedExpenseSettlement" JSONB;
