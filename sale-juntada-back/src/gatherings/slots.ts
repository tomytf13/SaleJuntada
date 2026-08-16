/**
 * Generación de horarios candidatos.
 *
 * Los slots se calculan una sola vez, del lado del servidor, en la zona horaria
 * de la juntada. Antes cada navegador los generaba con su hora local, así que
 * dos participantes en zonas distintas producían instantes diferentes y el
 * matching (que agrupa por `startsAt`/`endsAt` exactos) nunca los cruzaba.
 */

export type GatheringSlot = {
  id: string;
  startsAt: string;
  endsAt: string;
};

export type SlotWindow = {
  windowStart: Date;
  windowEnd: Date;
  timeZone: string;
  durationMinutes: number;
  dailyStartMinutes: number;
  dailyEndMinutes: number;
  slotStepMinutes: number;
};

const MAX_DAYS = 31;
const MS_PER_MINUTE = 60_000;

export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

type CalendarDay = { year: number; month: number; day: number };

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string) {
  let formatter = partsFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

function readParts(date: Date, timeZone: string) {
  const parts = partsFormatter(timeZone).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    // Algunos motores emiten "24" para la medianoche con hour12: false.
    hour: read("hour") % 24,
    minute: read("minute"),
    second: read("second"),
  };
}

/** Offset de la zona respecto de UTC en ese instante, en ms (positivo al este). */
function timeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = readParts(date, timeZone);
  const asIfUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asIfUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** El día calendario en el que cae ese instante, según la zona de la juntada. */
export function calendarDayInZone(date: Date, timeZone: string): CalendarDay {
  const parts = readParts(date, timeZone);
  return { year: parts.year, month: parts.month, day: parts.day };
}

/**
 * Convierte "el día D a los M minutos de la medianoche, en esta zona" al
 * instante UTC correspondiente. `minutes` puede superar 1440 para franjas que
 * terminan al día siguiente.
 */
export function zonedWallClockToUtc(
  day: CalendarDay,
  minutes: number,
  timeZone: string,
): Date {
  const wallClock =
    Date.UTC(day.year, day.month - 1, day.day) + minutes * MS_PER_MINUTE;
  // Primera corrección con el offset del instante aproximado y una segunda
  // pasada para los bordes de horario de verano, donde el offset cambia.
  const firstPass = wallClock - timeZoneOffsetMs(new Date(wallClock), timeZone);
  const secondPass =
    wallClock - timeZoneOffsetMs(new Date(firstPass), timeZone);
  return new Date(secondPass);
}

function addDays(day: CalendarDay, amount: number): CalendarDay {
  const shifted = new Date(
    Date.UTC(day.year, day.month - 1, day.day + amount),
  );
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function isAfter(a: CalendarDay, b: CalendarDay) {
  if (a.year !== b.year) return a.year > b.year;
  if (a.month !== b.month) return a.month > b.month;
  return a.day > b.day;
}

export function buildSlots(window: SlotWindow): GatheringSlot[] {
  const {
    windowStart,
    windowEnd,
    durationMinutes,
    dailyStartMinutes,
    dailyEndMinutes,
    slotStepMinutes,
  } = window;
  const timeZone = isValidTimeZone(window.timeZone)
    ? window.timeZone
    : "UTC";

  if (slotStepMinutes <= 0 || durationMinutes <= 0) return [];

  const slots: GatheringSlot[] = [];
  const lastDay = calendarDayInZone(windowEnd, timeZone);
  let day = calendarDayInZone(windowStart, timeZone);

  for (let dayIndex = 0; dayIndex < MAX_DAYS; dayIndex += 1) {
    if (isAfter(day, lastDay)) break;

    for (
      let startMinutes = dailyStartMinutes;
      startMinutes + durationMinutes <= dailyEndMinutes;
      startMinutes += slotStepMinutes
    ) {
      const startsAt = zonedWallClockToUtc(day, startMinutes, timeZone);
      const endsAt = new Date(
        startsAt.getTime() + durationMinutes * MS_PER_MINUTE,
      );
      if (startsAt < windowStart || endsAt > windowEnd) continue;

      slots.push({
        id: startsAt.toISOString(),
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      });
    }

    day = addDays(day, 1);
  }

  return slots;
}
