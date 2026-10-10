import type { GatheringSlot } from "../services/gatheringService";

export type Slot = {
  id: string;
  day: string;
  date: string;
  time: string;
  range?: string;
  startsAt: string;
  endsAt: string;
};

export const avatarPresets = ["🦆", "🐸", "🦖", "🦥", "🦝", "🍕"];

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function dateInputValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function dateDaysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return dateInputValue(date);
}

export function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function timeFromMinutes(value: number) {
  const normalized = value % 1440;
  const hours = Math.floor(normalized / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (normalized % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function dateAtMinutes(date: string, minutes: number) {
  const value = new Date(`${date}T00:00:00`);
  value.setMinutes(minutes);
  return value;
}

export function listNames(names: string[]) {
  return new Intl.ListFormat("es-AR", {
    style: "long",
    type: "conjunction",
  }).format(names);
}

export function formatMoney(amountCents: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}

export function formatThousands(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digits ? Number(digits).toLocaleString("es-AR") : "";
}

export type ParticipantSession = {
  participantId: string;
  responseToken: string;
};

/**
 * La sesión se guarda por slug, no por id de juntada.
 *
 * El slug es lo único que se conoce al abrir `/j/:slug`, y ahora el token
 * tiene que viajar en el primer request: el backend decide con él si
 * devuelve la vista pública o la completa. Indexar por id obligaba a pedir
 * la juntada dos veces —una para averiguar el id y otra ya con
 * credencial— en cada carga.
 */
export function sessionKey(slug: string) {
  return `sale-juntada:participant:${slug}`;
}

export function storeParticipantSession(
  slug: string,
  participantId: string,
  responseToken: string,
) {
  localStorage.setItem(
    sessionKey(slug),
    JSON.stringify({ participantId, responseToken }),
  );
}

export function readParticipantSession(
  slug: string,
): ParticipantSession | null {
  try {
    const value = localStorage.getItem(sessionKey(slug));
    return value ? (JSON.parse(value) as ParticipantSession) : null;
  } catch {
    return null;
  }
}

/**
 * Le pone etiquetas legibles a un horario que viene del backend.
 *
 * Se formatea siempre en la zona horaria de la juntada, no en la de quien
 * mira: todo el grupo tiene que leer "Sáb 21:00" aunque alguien esté de viaje.
 */
export function decorateSlot(slot: GatheringSlot, timeZone?: string): Slot {
  const startsAt = new Date(slot.startsAt);
  const zone = timeZone ? { timeZone } : {};
  const capitalize = (value: string) =>
    value.charAt(0).toUpperCase() + value.slice(1);
  const day = new Intl.DateTimeFormat("es-AR", { weekday: "short", ...zone })
    .format(startsAt)
    .replace(".", "");
  const date = new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    ...zone,
  })
    .format(startsAt)
    .replace(".", "");
  const time = new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...zone,
  }).format(startsAt);

  return {
    id: slot.id,
    day: capitalize(day),
    date: capitalize(date),
    time,
    range: `${time} – ${new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", ...zone }).format(new Date(slot.endsAt))}${new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", ...zone }).format(startsAt) !== new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", ...zone }).format(new Date(slot.endsAt)) ? " (día siguiente)" : ""}`,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
  };
}

export async function makeAvatarThumbnail(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Elegí una imagen válida.");
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error("La foto es demasiado pesada. El máximo es 12 MB.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceX = (image.naturalWidth - side) / 2;
    const sourceY = (image.naturalHeight - side) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = 192;
    canvas.height = 192;
    canvas
      .getContext("2d")
      ?.drawImage(image, sourceX, sourceY, side, side, 0, 0, 192, 192);
    return canvas.toDataURL("image/jpeg", 0.68);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
