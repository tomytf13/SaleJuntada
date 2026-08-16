import type { Availability } from "../services/gatheringService";

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

const timeFormatter = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function joinTimes(times: string[]) {
  if (times.length < 2) return times[0] ?? "";
  if (times.length === 2) return `${times[0]} y ${times[1]}`;
  return `${times.slice(0, -1).join(", ")} y ${times.at(-1)}`;
}

export function formatAvailabilitySummary(
  availabilities: Availability[] | undefined,
) {
  const availableSlots = [...(availabilities ?? [])]
    .filter((availability) => availability.kind === "AVAILABLE")
    .sort(
      (first, second) =>
        new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime(),
    );

  if (availableSlots.length === 0) return "Todavía no respondió";

  const timesByDay = new Map<string, string[]>();
  for (const slot of availableSlots) {
    const startsAt = new Date(slot.startsAt);
    const day = dateFormatter.format(startsAt).replaceAll(".", "");
    const time = timeFormatter.format(startsAt);
    const times = timesByDay.get(day) ?? [];
    if (!times.includes(time)) times.push(time);
    timesByDay.set(day, times);
  }

  return [...timesByDay]
    .map(([day, times]) => `${day}: ${joinTimes(times)}`)
    .join(" · ");
}
