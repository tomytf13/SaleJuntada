-- Cada confirmación de transferencia pertenece a una ronda de gastos.
--
-- La clave única incluía el monto, así que si el mismo par de personas tenía
-- que transferirse dos veces el mismo importe (por ejemplo, tras cargar gastos
-- nuevos), el upsert encontraba la fila anterior y sólo actualizaba la fecha.
-- El ajuste de saldo se contaba una sola vez y la deuda quedaba viva para
-- siempre. Con la ronda en la clave, cada pago real es una fila propia.
ALTER TABLE "TransferConfirmation"
ADD COLUMN "expenseRound" INTEGER NOT NULL DEFAULT 1;

-- Las confirmaciones existentes pertenecen a la ronda actual de su juntada.
UPDATE "TransferConfirmation" AS tc
SET "expenseRound" = g."expenseRound"
FROM "Gathering" AS g
WHERE g."id" = tc."gatheringId";

-- El nombre original del índice superaba los 63 caracteres de Postgres y quedó
-- truncado al crearse, así que lo ubicamos por sus columnas y no por nombre.
DO $$
DECLARE
  stale_index TEXT;
BEGIN
  SELECT i.relname INTO stale_index
  FROM pg_index x
  JOIN pg_class i ON i.oid = x.indexrelid
  JOIN pg_class t ON t.oid = x.indrelid
  WHERE t.relname = 'TransferConfirmation'
    AND x.indisunique
    AND EXISTS (
      SELECT 1
      FROM pg_attribute a
      WHERE a.attrelid = t.oid
        AND a.attnum = ANY (x.indkey)
        AND a.attname = 'amountCents'
    )
  LIMIT 1;

  IF stale_index IS NOT NULL THEN
    EXECUTE format('DROP INDEX %I', stale_index);
  END IF;
END $$;

CREATE UNIQUE INDEX "TransferConfirmation_round_pair_key"
ON "TransferConfirmation"("gatheringId", "expenseRound", "fromParticipantId", "toParticipantId");
