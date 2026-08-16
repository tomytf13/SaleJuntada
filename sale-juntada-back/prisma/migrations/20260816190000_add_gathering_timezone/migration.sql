-- La juntada guarda la zona horaria en la que fue creada.
--
-- Antes los horarios candidatos se generaban en el navegador con la hora local
-- de quien miraba. Como el matching agrupa por instante exacto, dos personas en
-- husos distintos producían horarios diferentes y no cruzaban nunca. Ahora los
-- genera el backend en esta zona, iguales para todo el grupo.
--
-- El default corresponde a las juntadas ya creadas, todas en Argentina.
ALTER TABLE "Gathering"
ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires';
