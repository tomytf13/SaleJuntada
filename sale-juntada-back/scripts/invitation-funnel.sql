-- Una observación por juntada creada desde la activación de las métricas.
-- Las etapas registran la primera apertura, el primer invitado identificado
-- y la primera respuesta de asistencia o disponibilidad de un invitado.
SELECT date_trunc('week', g."createdAt")::date AS semana,
 count(*) AS creadas, count("inviteOpenedAt") AS abiertas,
 count("inviteIdentifiedAt") AS con_invitado_identificado,
 count("inviteRespondedAt") AS con_respuesta,
 round(100.0 * count("inviteRespondedAt") / count(*), 1) AS porcentaje_con_respuesta
FROM "Gathering" g WHERE g."createdAt" >= (SELECT finished_at FROM "_prisma_migrations"
 WHERE migration_name = '20261122140000_expense_shares_and_invites' AND finished_at IS NOT NULL LIMIT 1)
GROUP BY 1 ORDER BY 1 DESC;
