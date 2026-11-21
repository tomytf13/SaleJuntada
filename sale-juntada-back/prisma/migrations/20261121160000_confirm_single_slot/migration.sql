-- Reconstituir las opciones de cada encuesta abierta en su zona horaria.
WITH windows AS (
  SELECT g.*,
    (("windowStart" AT TIME ZONE 'UTC') AT TIME ZONE "timeZone")::date AS first_day,
    (("windowEnd" AT TIME ZONE 'UTC') AT TIME ZONE "timeZone")::date AS last_day
  FROM "Gathering" g
  WHERE status = 'OPEN' AND "durationMinutes" > 0 AND "slotStepMinutes" > 0
), candidates AS (
  SELECT w.*, start_at, start_at + make_interval(mins => "durationMinutes") AS end_at
  FROM windows w
  CROSS JOIN LATERAL generate_series(0, least(last_day - first_day, 30)) AS d(day_offset)
  CROSS JOIN LATERAL generate_series("dailyStartMinutes", "dailyEndMinutes" - "durationMinutes",
                                    nullif("slotStepMinutes", 0)) AS m(minutes)
  CROSS JOIN LATERAL (SELECT (((first_day + day_offset) + make_interval(mins => minutes))
                               AT TIME ZONE "timeZone") AT TIME ZONE 'UTC' AS start_at) AS slot
), single_slots AS (
  SELECT id, min(start_at) AS start_at, min(end_at) AS end_at
  FROM candidates
  WHERE start_at >= "windowStart" AND end_at <= "windowEnd"
  GROUP BY id HAVING count(*) = 1
), confirmed AS (
  UPDATE "Gathering" g SET status = 'CONFIRMED', "finalizedStart" = s.start_at,
    "finalizedEnd" = s.end_at, "finalizedLocation" = g."locationHint",
    "updatedAt" = now() AT TIME ZONE 'UTC'
  FROM single_slots s WHERE g.id = s.id AND g.status = 'OPEN'
  RETURNING g.id
)
UPDATE "Participant" p SET "rsvpStatus" = 'GOING', "rsvpAt" = now() AT TIME ZONE 'UTC',
  "updatedAt" = now() AT TIME ZONE 'UTC'
FROM confirmed WHERE p."gatheringId" = confirmed.id AND p."isOrganizer";
