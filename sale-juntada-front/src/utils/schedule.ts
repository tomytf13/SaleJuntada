export function calendarDate(value: string | Date, timeZone?: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function shiftDay(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
export function clockTime(value: string, timeZone?: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}
export function scheduleInstant(
  day: string,
  minutes: number,
  timeZone?: string,
) {
  const wall = new Date(`${day}T00:00:00Z`).getTime() + minutes * 60000;
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offset = (instant: number) => {
    const date = new Date(instant);
    return (
      new Date(
        `${calendarDate(date, zone)}T${clockTime(date.toISOString(), zone)}:00Z`,
      ).getTime() - instant
    );
  };
  const first = wall - offset(wall);
  return new Date(wall - offset(first));
}
