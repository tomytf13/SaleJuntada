import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import {
  ExpenseSettlement,
  Gathering,
  gatheringService,
  Match,
  SOCKET_URL,
} from "./services/gatheringService";
import {
  LocationPicker,
  SelectedLocation,
} from "./components/LocationPicker";
import {
  MobileBottomNav,
  MobileDashboard,
  PurchasePlanner,
} from "./components/MobileExperience";

type Slot = {
  id: string;
  day: string;
  date: string;
  time: string;
  startsAt: string;
  endsAt: string;
};

const supportAlias = import.meta.env.VITE_SUPPORT_ALIAS?.trim();
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
const avatarPresets = ["🦆", "🐸", "🦖", "🦥", "🦝", "🍕"];
const timeWindowPresets = [
  { label: "Almuerzo", icon: "☀️", start: "11:00", end: "17:00" },
  { label: "Tarde", icon: "🧉", start: "15:00", end: "22:00" },
  { label: "Noche", icon: "🌙", start: "19:00", end: "02:00" },
];

const demoSlots: Slot[] = [
  { id: "fri-21", day: "Vie", date: "24 Jul", time: "21:00", startsAt: "2026-07-24T21:00:00-03:00", endsAt: "2026-07-25T00:00:00-03:00" },
  { id: "sat-13", day: "Sáb", date: "25 Jul", time: "13:00", startsAt: "2026-07-25T13:00:00-03:00", endsAt: "2026-07-25T16:00:00-03:00" },
  { id: "sat-21", day: "Sáb", date: "25 Jul", time: "21:00", startsAt: "2026-07-25T21:00:00-03:00", endsAt: "2026-07-26T00:00:00-03:00" },
  { id: "sun-13", day: "Dom", date: "26 Jul", time: "13:00", startsAt: "2026-07-26T13:00:00-03:00", endsAt: "2026-07-26T16:00:00-03:00" },
  { id: "sun-20", day: "Dom", date: "26 Jul", time: "20:00", startsAt: "2026-07-26T20:00:00-03:00", endsAt: "2026-07-26T23:00:00-03:00" },
];

const friends = [
  { name: "Sofi", initials: "SO", color: "peach", available: ["fri-21", "sat-21", "sun-20"] },
  { name: "Fede", initials: "FE", color: "blue", available: ["sat-13", "sat-21", "sun-13"] },
  { name: "Mica", initials: "MI", color: "purple", available: ["fri-21", "sat-21", "sun-13", "sun-20"] },
  { name: "Nico", initials: "NI", color: "green", available: ["sat-13", "sat-21", "sun-20"] },
  { name: "Lu", initials: "LU", color: "yellow", available: ["fri-21", "sat-21", "sun-20"] },
];

function SparkIcon() {
  return <span aria-hidden="true">✦</span>;
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function dateInputValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function dateDaysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return dateInputValue(date);
}

function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function dateAtMinutes(date: string, minutes: number) {
  const value = new Date(`${date}T00:00:00`);
  value.setMinutes(minutes);
  return value;
}

function ParticipantAvatar({
  name,
  avatarUrl,
  color = "peach",
}: {
  name: string;
  avatarUrl?: string | null;
  color?: string;
}) {
  if (avatarUrl?.startsWith("emoji:")) {
    return (
      <span className={`person-avatar avatar-emoji ${color}`} aria-label={`Avatar de ${name}`}>
        {avatarUrl.slice(6)}
      </span>
    );
  }
  if (avatarUrl) {
    return (
      <span className={`person-avatar avatar-photo ${color}`}>
        <img src={avatarUrl} alt={`Avatar de ${name}`} />
      </span>
    );
  }
  return <span className={`person-avatar ${color}`}>{initials(name)}</span>;
}

async function makeAvatarThumbnail(file: File) {
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
    canvas.getContext("2d")?.drawImage(
      image,
      sourceX,
      sourceY,
      side,
      side,
      0,
      0,
      192,
      192,
    );
    return canvas.toDataURL("image/jpeg", 0.68);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function listNames(names: string[]) {
  return new Intl.ListFormat("es-AR", {
    style: "long",
    type: "conjunction",
  }).format(names);
}

function formatMoney(amountCents: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}

function formatThousands(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digits ? Number(digits).toLocaleString("es-AR") : "";
}

type ParticipantSession = {
  participantId: string;
  responseToken: string;
};

function sessionKey(gatheringId: string) {
  return `sale-juntada:participant:${gatheringId}`;
}

function storeParticipantSession(
  gatheringId: string,
  participantId: string,
  responseToken: string,
) {
  localStorage.setItem(
    sessionKey(gatheringId),
    JSON.stringify({ participantId, responseToken }),
  );
}

function readParticipantSession(gatheringId: string): ParticipantSession | null {
  try {
    const value = localStorage.getItem(sessionKey(gatheringId));
    return value ? JSON.parse(value) as ParticipantSession : null;
  } catch {
    return null;
  }
}

function buildGatheringSlots(gathering: Gathering): Slot[] {
  const windowStart = new Date(gathering.windowStart);
  const windowEnd = new Date(gathering.windowEnd);
  const dailyStartMinutes = gathering.dailyStartMinutes ?? 780;
  const dailyEndMinutes = gathering.dailyEndMinutes ?? 1440;
  const slotStepMinutes = gathering.slotStepMinutes ?? 480;
  const cursor = new Date(windowStart);
  cursor.setHours(0, 0, 0, 0);
  const result: Slot[] = [];

  for (let dayIndex = 0; dayIndex < 31 && cursor <= windowEnd; dayIndex += 1) {
    for (
      let startMinutes = dailyStartMinutes;
      startMinutes + gathering.durationMinutes <= dailyEndMinutes;
      startMinutes += slotStepMinutes
    ) {
      const startsAt = new Date(cursor);
      startsAt.setMinutes(startMinutes);
      const endsAt = new Date(
        startsAt.getTime() + gathering.durationMinutes * 60_000,
      );
      if (startsAt < windowStart || endsAt > windowEnd) continue;

      const day = new Intl.DateTimeFormat("es-AR", {
        weekday: "short",
      }).format(startsAt).replace(".", "");
      const date = new Intl.DateTimeFormat("es-AR", {
        day: "numeric",
        month: "short",
      }).format(startsAt).replace(".", "");
      const time = new Intl.DateTimeFormat("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(startsAt);

      result.push({
        id: startsAt.toISOString(),
        day: day.charAt(0).toUpperCase() + day.slice(1),
        date: date.charAt(0).toUpperCase() + date.slice(1),
        time,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

export default function Home() {
  const locationState = useLocation();
  const navigate = useNavigate();
  const [eventName, setEventName] = useState("Asado con los pibes");
  const [location, setLocation] = useState("Yerba Buena");
  const [yourSlots, setYourSlots] = useState<string[]>(["fri-21", "sat-21", "sun-20"]);
  const [showCreate, setShowCreate] = useState(false);
  const [createFrom, setCreateFrom] = useState(() => dateDaysFromNow(1));
  const [createTo, setCreateTo] = useState(() => dateDaysFromNow(3));
  const [createStartTime, setCreateStartTime] = useState("19:00");
  const [createEndTime, setCreateEndTime] = useState("02:00");
  const [createDuration, setCreateDuration] = useState(180);
  const [selectedLocation, setSelectedLocation] =
    useState<SelectedLocation | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [confirmedSlot, setConfirmedSlot] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [activeGathering, setActiveGathering] = useState<Gathering | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoadingGathering, setIsLoadingGathering] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);
  const [apiError, setApiError] = useState("");
  const [showJoin, setShowJoin] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState("emoji:🦆");
  const [isPreparingAvatar, setIsPreparingAvatar] = useState(false);
  const [participantSession, setParticipantSession] =
    useState<ParticipantSession | null>(null);
  const [expenseSettlement, setExpenseSettlement] =
    useState<ExpenseSettlement | null>(null);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [isMarkingExpensesReady, setIsMarkingExpensesReady] = useState(false);
  const [liveMembers, setLiveMembers] = useState<
    Array<{ participantId: string; name: string }>
  >([]);
  const [typingMembers, setTypingMembers] = useState<
    Array<{ participantId: string; name: string }>
  >([]);
  const [analyzingMembers, setAnalyzingMembers] = useState<
    Array<{ participantId: string; name: string }>
  >([]);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  const slots = useMemo(
    () => activeGathering ? buildGatheringSlots(activeGathering) : demoSlots,
    [activeGathering],
  );
  const slotGroups = useMemo(() => {
    const groups = new Map<string, { day: string; date: string; slots: Slot[] }>();
    for (const slot of slots) {
      const key = `${slot.day}-${slot.date}`;
      const group = groups.get(key) ?? {
        day: slot.day,
        date: slot.date,
        slots: [],
      };
      group.slots.push(slot);
      groups.set(key, group);
    }
    return [...groups.values()];
  }, [slots]);

  useEffect(() => {
    const match = locationState.pathname.match(/^\/j\/([^/]+)$/);
    if (!match) return;

    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (!cancelled) {
          setIsLoadingGathering(true);
          setApiError("");
        }
        return gatheringService.getBySlug(decodeURIComponent(match[1]));
      })
      .then((gathering) => {
        if (cancelled) return;
        setActiveGathering(gathering);
        setEventName(gathering.title);
        setLocation(gathering.locationHint ?? "Lugar a definir");
        gatheringService
          .getMatches(gathering.id)
          .then((result) => {
            if (!cancelled) setMatches(result);
          })
          .catch(() => {
            if (!cancelled) setMatches([]);
          });
        gatheringService
          .getExpenseSettlement(gathering.id)
          .then((result) => {
            if (!cancelled) setExpenseSettlement(result);
          })
          .catch(() => {
            if (!cancelled) setExpenseSettlement(null);
          });
        const session = readParticipantSession(gathering.id);
        const participant = gathering.participants.find(
          (candidate) => candidate.id === session?.participantId,
        );
        if (session && participant) {
          setParticipantSession(session);
          setYourSlots(
            participant.availabilities
              ?.filter((availability) => availability.kind === "AVAILABLE")
              .map((availability) => availability.startsAt) ?? [],
          );
        } else {
          setParticipantSession(null);
          setYourSlots([]);
          setShowJoin(true);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setApiError(
            error instanceof Error ? error.message : "No pudimos abrir esta juntada.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingGathering(false);
      });

    return () => {
      cancelled = true;
    };
  }, [locationState.pathname]);

  useEffect(() => {
    if (!showJoin || !activeGathering || !googleClientId) return;
    let cancelled = false;

    const renderGoogleButton = () => {
      const google = (window as typeof window & {
        google?: {
          accounts: {
            id: {
              initialize(options: {
                client_id: string;
                callback(response: { credential: string }): void;
              }): void;
              renderButton(
                element: HTMLElement,
                options: Record<string, string | number>,
              ): void;
            };
          };
        };
      }).google;
      if (!google || !googleButtonRef.current || cancelled) return;

      google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async ({ credential }) => {
          setIsSubmitting(true);
          setApiError("");
          try {
            const participant = await gatheringService.addGoogleParticipant(
              activeGathering.id,
              credential,
            );
            if (!participant.responseToken) {
              throw new Error("Google no pudo crear tu acceso.");
            }
            const session = {
              participantId: participant.id,
              responseToken: participant.responseToken,
            };
            storeParticipantSession(
              activeGathering.id,
              session.participantId,
              session.responseToken,
            );
            setParticipantSession(session);
            setActiveGathering((current) => {
              if (!current) return current;
              const alreadyExists = current.participants.some(
                (candidate) => candidate.id === participant.id,
              );
              return alreadyExists
                ? current
                : {
                    ...current,
                    participants: [...current.participants, participant],
                  };
            });
            setYourSlots(
              participant.availabilities
                ?.filter((availability) => availability.kind === "AVAILABLE")
                .map((availability) => availability.startsAt) ?? [],
            );
            setShowJoin(false);
            setNotice(`¡Listo, ${participant.name}! Entraste con Google.`);
            window.setTimeout(() => setNotice(""), 2800);
          } catch (error) {
            setApiError(
              error instanceof Error
                ? error.message
                : "No pudimos ingresar con Google.",
            );
          } finally {
            setIsSubmitting(false);
          }
        },
      });
      googleButtonRef.current.replaceChildren();
      google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "continue_with",
        width: 320,
        locale: "es",
      });
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-sale-juntada-google="true"]',
    );
    if (existingScript) {
      renderGoogleButton();
    } else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.dataset.saleJuntadaGoogle = "true";
      script.addEventListener("load", renderGoogleButton, { once: true });
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, [showJoin, activeGathering]);

  useEffect(() => {
    if (!activeGathering) return;
    const participant = activeGathering.participants.find(
      (candidate) => candidate.id === participantSession?.participantId,
    );

    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;
    const join = () => {
      if (participant) {
        socket.emit("gathering:join", {
          gatheringId: activeGathering.id,
          participantId: participant.id,
          participantToken: participantSession?.responseToken,
        });
      } else {
        socket.emit("gathering:watch", {
          gatheringId: activeGathering.id,
        });
      }
    };
    const refreshExpenses = async (payload?: { participantName?: string }) => {
      setExpenseSettlement(
        await gatheringService.getExpenseSettlement(activeGathering.id),
      );
      if (
        payload?.participantName &&
        payload.participantName !== participant?.name
      ) {
        setNotice(`${payload.participantName} actualizó las cuentas.`);
        window.setTimeout(() => setNotice(""), 2800);
      }
    };

    socket.on("connect", () => {
      setIsLiveConnected(true);
      join();
    });
    socket.on("disconnect", () => setIsLiveConnected(false));
    socket.on(
      "presence:changed",
      (members: Array<{ participantId: string; name: string }>) =>
        setLiveMembers(members),
    );
    socket.on(
      "expense:typing",
      (member: { participantId: string; name: string; isTyping: boolean }) => {
        setTypingMembers((current) => {
          const others = current.filter(
            (candidate) => candidate.participantId !== member.participantId,
          );
          return member.isTyping ? [...others, member] : others;
        });
      },
    );
    socket.on(
      "analysis:activity",
      (member: { participantId: string; name: string; active: boolean }) => {
        setAnalyzingMembers((current) => {
          const others = current.filter(
            (candidate) => candidate.participantId !== member.participantId,
          );
          return member.active ? [...others, member] : others;
        });
      },
    );
    socket.on("expenses:changed", refreshExpenses);
    socket.on("transfers:changed", refreshExpenses);

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setLiveMembers([]);
      setTypingMembers([]);
      setAnalyzingMembers([]);
      setIsLiveConnected(false);
    };
  }, [activeGathering, participantSession]);

  const rankedSlots = useMemo(() => {
    return slots
      .map((slot) => {
        const friendCount = friends.filter((friend) =>
          friend.available.includes(slot.id),
        ).length;
        const available = friendCount + (yourSlots.includes(slot.id) ? 1 : 0);
        return { ...slot, available, missing: 6 - available };
      })
      .sort((a, b) => b.available - a.available);
  }, [slots, yourSlots]);

  const toggleSlot = async (slotId: string) => {
    setConfirmedSlot(null);
    if (activeGathering && !participantSession) {
      setShowJoin(true);
      return;
    }

    const nextSlots = yourSlots.includes(slotId)
      ? yourSlots.filter((id) => id !== slotId)
      : [...yourSlots, slotId];
    setYourSlots(nextSlots);

    if (!activeGathering || !participantSession) return;
    setIsSavingAvailability(true);
    setApiError("");
    try {
      await gatheringService.setAvailability(
        activeGathering.id,
        participantSession.participantId,
        participantSession.responseToken,
        slots
          .filter((slot) => nextSlots.includes(slot.id))
          .map((slot) => ({
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            kind: "AVAILABLE" as const,
          })),
      );
      setMatches(await gatheringService.getMatches(activeGathering.id));
      setActiveGathering((current) => {
        if (!current) return current;
        return {
          ...current,
          participants: current.participants.map((participant) =>
            participant.id === participantSession.participantId
              ? {
                  ...participant,
                  availabilities: slots
                    .filter((slot) => nextSlots.includes(slot.id))
                    .map((slot) => ({
                      id: slot.id,
                      startsAt: slot.startsAt,
                      endsAt: slot.endsAt,
                      kind: "AVAILABLE" as const,
                    })),
                }
              : participant,
          ),
        };
      });
    } catch (error) {
      setYourSlots(yourSlots);
      setApiError(
        error instanceof Error
          ? error.message
          : "No pudimos guardar tu disponibilidad.",
      );
    } finally {
      setIsSavingAvailability(false);
    }
  };

  const shareEvent = async () => {
    const text = `¿Sale juntada? Marcá cuándo podés para “${eventName}”.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: eventName, text, url: window.location.href });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${window.location.href}`);
      setNotice("Link copiado. Mandalo al grupo y listo.");
    } catch {
      setNotice("El link está listo para compartir.");
    }
    window.setTimeout(() => setNotice(""), 2800);
  };

  const copySupportAlias = async () => {
    if (!supportAlias) return;
    await navigator.clipboard.writeText(supportAlias);
    setNotice("Alias copiado. ¡Gracias por la buena onda! 🍺");
    window.setTimeout(() => setNotice(""), 2800);
  };

  const createEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    const place = selectedLocation?.label ?? "";
    const organizerName = String(form.get("organizerName") || "").trim();
    const from = String(form.get("from") || "");
    const to = String(form.get("to") || "");
    const startMinutes = minutesFromTime(createStartTime);
    const rawEndMinutes = minutesFromTime(createEndTime);
    const endMinutes =
      rawEndMinutes <= startMinutes ? rawEndMinutes + 1440 : rawEndMinutes;

    if (!from || !to || to < from) {
      setApiError("Elegí un rango de fechas válido.");
      return;
    }
    if (endMinutes - startMinutes < createDuration) {
      setApiError("La franja debe alcanzar para la duración de la juntada.");
      return;
    }

    setIsSubmitting(true);
    setApiError("");
    try {
      const gathering = await gatheringService.create({
        title,
        organizerName,
        organizerAvatarUrl: selectedAvatar,
        locationHint: place || undefined,
        locationLatitude: selectedLocation?.latitude,
        locationLongitude: selectedLocation?.longitude,
        windowStart: dateAtMinutes(from, startMinutes).toISOString(),
        windowEnd: dateAtMinutes(to, endMinutes).toISOString(),
        durationMinutes: createDuration,
        dailyStartMinutes: startMinutes,
        dailyEndMinutes: endMinutes,
        slotStepMinutes: 60,
      });
      setActiveGathering(gathering);
      setEventName(gathering.title);
      setLocation(gathering.locationHint ?? "Lugar a definir");
      const organizer = gathering.participants.find(
        (participant) => participant.isOrganizer,
      );
      if (organizer?.responseToken) {
        const session = {
          participantId: organizer.id,
          responseToken: organizer.responseToken,
        };
        storeParticipantSession(gathering.id, session.participantId, session.responseToken);
        setParticipantSession(session);
        setYourSlots([]);
      }
      setShowCreate(false);
      navigate(`/j/${gathering.slug}`);
      setNotice("Juntada creada. Ahora compartila con el grupo.");
      window.setTimeout(() => setNotice(""), 2800);
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : "No pudimos crear la juntada.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const joinGathering = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeGathering) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("participantName") || "").trim();

    setIsSubmitting(true);
    setApiError("");
    try {
      const participant = await gatheringService.addParticipant(
        activeGathering.id,
        name,
        selectedAvatar,
      );
      if (!participant.responseToken) {
        throw new Error("No pudimos crear tu acceso a la juntada.");
      }
      const session = {
        participantId: participant.id,
        responseToken: participant.responseToken,
      };
      storeParticipantSession(activeGathering.id, session.participantId, session.responseToken);
      setParticipantSession(session);
      setActiveGathering({
        ...activeGathering,
        participants: [...activeGathering.participants, participant],
      });
      setYourSlots([]);
      setShowJoin(false);
      setNotice(`¡Listo, ${participant.name}! Marcá cuándo podés.`);
      window.setTimeout(() => setNotice(""), 2800);
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : "No pudimos sumarte.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const addExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeGathering || !participantSession) {
      setShowJoin(true);
      return;
    }

    const form = event.currentTarget;
    const data = new FormData(form);
    const description = String(data.get("expenseDescription") || "").trim();
    const amount = Number(expenseAmount.replace(/\./g, ""));
    if (!description || !Number.isFinite(amount) || amount <= 0) return;

    setIsSavingExpense(true);
    setApiError("");
    try {
      await gatheringService.addExpense(
        activeGathering.id,
        participantSession.participantId,
        participantSession.responseToken,
        {
          description,
          amountCents: Math.round(amount * 100),
        },
      );
      setExpenseSettlement(
        await gatheringService.getExpenseSettlement(activeGathering.id),
      );
      form.reset();
      setExpenseAmount("");
      socketRef.current?.emit("expense:typing", {
        gatheringId: activeGathering.id,
        isTyping: false,
      });
      setNotice("Gasto agregado y cuentas recalculadas.");
      window.setTimeout(() => setNotice(""), 2800);
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : "No pudimos guardar el gasto.",
      );
    } finally {
      setIsSavingExpense(false);
    }
  };

  const signalExpenseTyping = () => {
    if (!activeGathering) return;
    socketRef.current?.emit("expense:typing", {
      gatheringId: activeGathering.id,
      isTyping: true,
    });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit("expense:typing", {
        gatheringId: activeGathering.id,
        isTyping: false,
      });
    }, 1_200);
  };

  const confirmTransferPayment = async (
    transfer: NonNullable<ExpenseSettlement["transfers"]>[number],
  ) => {
    if (!activeGathering || !participantSession) return;
    setApiError("");
    try {
      await gatheringService.confirmTransfer(
        activeGathering.id,
        participantSession.participantId,
        participantSession.responseToken,
        {
          toParticipantId: transfer.toParticipantId,
          amountCents: transfer.amountCents,
        },
      );
      setExpenseSettlement(
        await gatheringService.getExpenseSettlement(activeGathering.id),
      );
      setNotice("Transferencia marcada como realizada.");
      window.setTimeout(() => setNotice(""), 2800);
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : "No pudimos confirmar la transferencia.",
      );
    }
  };

  const markExpensesReady = async () => {
    if (!activeGathering || !participantSession) return;
    setIsMarkingExpensesReady(true);
    setApiError("");
    try {
      await gatheringService.markExpensesReady(
        activeGathering.id,
        participantSession.participantId,
        participantSession.responseToken,
      );
      setExpenseSettlement(
        await gatheringService.getExpenseSettlement(activeGathering.id),
      );
      setNotice("Confirmaste que ya cargaste todos tus gastos.");
      window.setTimeout(() => setNotice(""), 2800);
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : "No pudimos confirmar tus gastos.",
      );
    } finally {
      setIsMarkingExpensesReady(false);
    }
  };

  const confirmProposal = (slotId: string) => {
    setConfirmedSlot(slotId);
    setShowResults(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirmed = slots.find((slot) => slot.id === confirmedSlot);
  const currentParticipant = activeGathering?.participants.find(
    (participant) => participant.id === participantSession?.participantId,
  );
  const currentParticipantExpensesReady =
    expenseSettlement?.readyParticipants.some(
      (participant) => participant.participantId === currentParticipant?.id,
    ) ?? false;
  const respondingParticipants = activeGathering?.participants.filter(
    (participant) => (participant.availabilities?.length ?? 0) > 0,
  ).length ?? 0;
  const bestMatch = matches[0];
  const resultAnalysis = useMemo(() => {
    if (!activeGathering || !bestMatch) return null;
    const bestPendingNames = bestMatch.pendingParticipantNames ?? [];
    const bestConflictNames = bestMatch.conflictParticipantNames ?? [];

    if (bestMatch.available === bestMatch.total) {
      return {
        title: "Hay un horario donde pueden todos",
        detail: "No hace falta negociar cambios: ya tienen una coincidencia completa.",
        action: "Pueden confirmarlo directamente.",
      };
    }

    if (bestPendingNames.length > 0 && bestConflictNames.length === 0) {
      return {
        title: "Primero falta una respuesta",
        detail: `${listNames(bestPendingNames)} todavía no cargó disponibilidad. El mejor horario actual reúne a ${bestMatch.available} de ${bestMatch.total}.`,
        action: `Preguntale a ${listNames(bestPendingNames)} si puede sumarse a esta opción antes de mover al resto.`,
      };
    }

    if (bestPendingNames.length === 0 && bestConflictNames.length > 0) {
      return {
        title: `Están a ${bestConflictNames.length} ${bestConflictNames.length === 1 ? "cambio" : "cambios"} de coincidir`,
        detail: `${listNames(bestConflictNames)} ya respondió, pero no puede en la mejor opción.`,
        action: `La negociación más corta es preguntarle a ${listNames(bestConflictNames)} si puede liberar ese horario.`,
      };
    }

    return {
      title: "Hay respuestas pendientes y horarios para negociar",
      detail: `${listNames(bestPendingNames)} todavía no respondió. Además, ${listNames(bestConflictNames)} marcó otros horarios.`,
      action: "Conviene completar las respuestas pendientes y después negociar con quienes sigan afuera.",
    };
  }, [activeGathering, bestMatch]);
  const heroData = useMemo(() => {
    if (!activeGathering) {
      return {
        weekday: "SÁB",
        day: "25",
        title: "Este sábado",
        detail: `21:00 · ${location}`,
        available: 6,
        total: 6,
        people: friends.map((friend) => ({
          id: friend.name,
          name: friend.name,
          label: friend.initials,
        })),
        pill: "Match perfecto",
        note: "Ejemplo de cómo se ve el mejor horario del grupo.",
      };
    }

    const bestMatch = matches[0];
    if (!bestMatch) {
      const startsAt = new Date(activeGathering.windowStart);
      return {
        weekday: new Intl.DateTimeFormat("es-AR", { weekday: "short" })
          .format(startsAt)
          .replace(".", "")
          .toUpperCase(),
        day: new Intl.DateTimeFormat("es-AR", { day: "numeric" }).format(startsAt),
        title: "Esperando respuestas",
        detail: location,
        available: 0,
        total: activeGathering.participants.length,
        people: activeGathering.participants.map((participant) => ({
          id: participant.id,
          name: participant.name,
          label: initials(participant.name),
        })),
        pill: "En progreso",
        note: "Cuando el grupo responda, acá aparecerá la mejor coincidencia.",
      };
    }

    const startsAt = new Date(bestMatch.startsAt);
    const startTime = startsAt.getTime();
    const endTime = new Date(bestMatch.endsAt).getTime();
    const people = activeGathering.participants
      .filter((participant) =>
        participant.availabilities?.some(
          (availability) =>
            availability.kind === "AVAILABLE" &&
            new Date(availability.startsAt).getTime() === startTime &&
            new Date(availability.endsAt).getTime() === endTime,
        ),
      )
      .map((participant) => ({
        id: participant.id,
        name: participant.name,
        label: initials(participant.name),
      }));

    return {
      weekday: new Intl.DateTimeFormat("es-AR", { weekday: "short" })
        .format(startsAt)
        .replace(".", "")
        .toUpperCase(),
      day: new Intl.DateTimeFormat("es-AR", { day: "numeric" }).format(startsAt),
      title: new Intl.DateTimeFormat("es-AR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(startsAt),
      detail: `${new Intl.DateTimeFormat("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(startsAt)} · ${location}`,
      available: bestMatch.available,
      total: bestMatch.total,
      people,
      pill: bestMatch.available === bestMatch.total
        ? "Match perfecto"
        : "Mejor opción",
      note: "Calculamos esta opción con las disponibilidades cargadas por el grupo.",
    };
  }, [activeGathering, location, matches]);

  const createSchedulePreview = useMemo(() => {
    const firstDay = new Date(`${createFrom}T00:00:00`);
    const lastDay = new Date(`${createTo}T00:00:00`);
    const dayCount = Math.max(
      1,
      Math.round((lastDay.getTime() - firstDay.getTime()) / 86_400_000) + 1,
    );
    const startMinutes = minutesFromTime(createStartTime);
    const rawEndMinutes = minutesFromTime(createEndTime);
    const overnight = rawEndMinutes <= startMinutes;
    const endMinutes = overnight ? rawEndMinutes + 1440 : rawEndMinutes;
    const optionsPerDay = Math.max(
      0,
      Math.floor((endMinutes - startMinutes - createDuration) / 60) + 1,
    );

    return {
      dayCount,
      overnight,
      optionsPerDay,
      totalOptions: dayCount * optionsPerDay,
    };
  }, [
    createDuration,
    createEndTime,
    createFrom,
    createStartTime,
    createTo,
  ]);

  const findBestMoment = async () => {
    if (!activeGathering) {
      setShowResults(true);
      return;
    }

    setApiError("");
    socketRef.current?.emit("analysis:started", {
      gatheringId: activeGathering.id,
    });
    try {
      setMatches(await gatheringService.getMatches(activeGathering.id));
      setShowResults(true);
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : "No pudimos calcular los horarios.",
      );
    }
  };

  return (
    <main className="app-root">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="Sale Juntada, inicio">
          <span className="brand-mark"><SparkIcon /></span>
          <span>Sale Juntada</span>
        </a>
        <div className="header-actions">
          <button className="icon-button" aria-label="Notificaciones">●</button>
          <button className="avatar-button" aria-label="Tu perfil">
            {activeGathering && participantSession
              ? (() => {
                  const participant = activeGathering.participants.find(
                    (candidate) => candidate.id === participantSession.participantId,
                  );
                  return participant?.avatarUrl?.startsWith("emoji:")
                    ? participant.avatarUrl.slice(6)
                    : initials(participant?.name ?? "TF");
                })()
              : "TF"}
          </button>
        </div>
      </header>

      <MobileDashboard
        eventName={eventName}
        location={location}
        active={Boolean(activeGathering)}
        selectedCount={yourSlots.length}
        responseCount={activeGathering ? respondingParticipants : 6}
        match={heroData}
        confirmed={confirmed}
        onCreate={() => setShowCreate(true)}
        onShare={shareEvent}
        onOpenAvailability={() => document.getElementById("disponibilidad")?.scrollIntoView({ behavior: "smooth" })}
        onOpenResults={findBestMoment}
      />

      <section className="hero desktop-hero" id="inicio">
        <div className="hero-copy">
          <span className="eyebrow"><SparkIcon /> Coordinar sin vueltas</span>
          <h1>Que coincidir sea<br /><em>la parte fácil.</em></h1>
          <p>
            Todos ponen cuándo pueden. Nosotros encontramos el momento
            perfecto para que la juntada suceda.
          </p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => setShowCreate(true)}>
              Crear una juntada <span aria-hidden="true">→</span>
            </button>
            <a className="text-link" href="#disponibilidad">Ver cómo funciona</a>
          </div>
        </div>

        <div className="match-card" aria-label="Mejor coincidencia">
          <div className="match-card-top">
            <span className="mini-label">Mejor coincidencia</span>
            <span className="match-pill"><SparkIcon /> {heroData.pill}</span>
          </div>
          <div className="date-lockup">
            <div className="calendar-page">
              <span>{heroData.weekday}</span>
              <strong>{heroData.day}</strong>
            </div>
            <div>
              <h2>{heroData.title}</h2>
              <p>{heroData.detail}</p>
            </div>
          </div>
          <div className="people-row">
            <div
              className="avatar-stack"
              aria-label={`${heroData.available} personas disponibles`}
            >
              {heroData.people.slice(0, 4).map((person, index) => (
                <span
                  key={person.id}
                  className={`person-avatar ${["peach", "blue", "purple", "green"][index % 4]}`}
                  title={person.name}
                >
                  {person.label}
                </span>
              ))}
              {heroData.people.length > 4 && (
                <span className="person-avatar more">+{heroData.people.length - 4}</span>
              )}
            </div>
            <p>
              <strong>
                {heroData.available === heroData.total && heroData.total > 0
                  ? "¡Pueden todos!"
                  : "La opción que más suma"}
              </strong>
              <br />
              {heroData.available} de {heroData.total} disponibles
            </p>
          </div>
          <div className="progress-track">
            <span
              style={{
                width: `${heroData.total > 0
                  ? Math.round((heroData.available / heroData.total) * 100)
                  : 0}%`,
              }}
            />
          </div>
          <div className="ai-note"><SparkIcon /> {heroData.note}</div>
        </div>
      </section>

      {isLoadingGathering && (
        <div className="status-banner" role="status">
          Abriendo la juntada…
        </div>
      )}

      {apiError && (
        <div className="status-banner error" role="alert">
          {apiError}
        </div>
      )}

      {confirmed && (
        <section className="confirmed-banner" aria-live="polite">
          <div className="confirmed-icon">✓</div>
          <div>
            <span>¡Sale juntada!</span>
            <strong>{confirmed.day} {confirmed.date} a las {confirmed.time} · {location}</strong>
          </div>
          <button onClick={shareEvent}>Compartir confirmación</button>
        </section>
      )}

      <section className="workspace" id="disponibilidad">
        <div className="section-heading">
          <div>
            <span className="section-kicker">JUNTADA ACTIVA</span>
            <h2>{eventName}</h2>
            <p>Marcá todos los horarios en los que podrías sumarte.</p>
            {activeGathering?.locationLatitude != null &&
              activeGathering.locationLongitude != null && (
                <a
                  className="map-link"
                  href={`https://www.openstreetmap.org/?mlat=${activeGathering.locationLatitude}&mlon=${activeGathering.locationLongitude}#map=17/${activeGathering.locationLatitude}/${activeGathering.locationLongitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  📍 {activeGathering.locationHint ?? "Ver ubicación"} · Ver mapa
                </a>
              )}
          </div>
          <button className="share-button" onClick={shareEvent}>
            <span aria-hidden="true">↗</span> Compartir link
          </button>
        </div>

        <div className="planning-grid">
          <div className="availability-card">
            <div className="card-title-row">
              <div>
                <h3>¿Cuándo podés?</h3>
                <p>Podés elegir más de una opción.</p>
              </div>
              <span className="selection-count">{yourSlots.length} elegidos</span>
            </div>

            <div className="slot-grid" role="group" aria-label="Elegí tus horarios disponibles">
              {slotGroups.map((group) => (
                <section className="day-slot-group" key={`${group.day}-${group.date}`}>
                  <div className="day-slot-heading">
                    <span>{group.day}</span>
                    <strong>{group.date.split(" ")[0]}</strong>
                    <small>{group.date.split(" ")[1]}</small>
                  </div>
                  <div className="time-options">
                    {group.slots.map((slot) => {
                      const selected = yourSlots.includes(slot.id);
                      return (
                        <button
                          key={slot.id}
                          className={`time-option ${selected ? "selected" : ""}`}
                          aria-label={`${slot.day} ${slot.date} · ${slot.time}`}
                          aria-pressed={selected}
                          disabled={isSavingAvailability}
                          onClick={() => toggleSlot(slot.id)}
                        >
                          <span>{slot.time}</span>
                          <i>{selected ? "✓" : "+"}</i>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>

            <div className="your-status">
              <span className="person-avatar coral">
                {currentParticipant ? initials(currentParticipant.name) : "VO"}
              </span>
              <div>
                <strong>
                  {currentParticipant?.name ?? "Tu disponibilidad"}
                </strong>
                <small>
                  {activeGathering
                    ? "Se guarda automáticamente"
                    : "Probá el flujo antes de crearla"}
                </small>
              </div>
              <span className="saved-dot">
                ● {isSavingAvailability ? "Guardando…" : "Guardado"}
              </span>
            </div>
          </div>

          <aside className="group-card">
            <div className="card-title-row">
              <div>
                <h3>El grupo</h3>
                <p>
                  {activeGathering
                    ? `${activeGathering.participants.length} personas`
                    : "6 personas invitadas"}
                </p>
              </div>
              <span className="response-pill">
                {activeGathering
                  ? `${respondingParticipants}/${activeGathering.participants.length} respondieron`
                  : "6/6 respondieron"}
              </span>
            </div>
            <div className="friend-list">
              {!activeGathering && friends.map((friend) => (
                <div className="friend-row" key={friend.name}>
                  <span className={`person-avatar ${friend.color}`}>{friend.initials}</span>
                  <div><strong>{friend.name}</strong><small>{friend.available.length} horarios disponibles</small></div>
                  <span className="check">✓</span>
                </div>
              ))}
              {!activeGathering && <div className="friend-row">
                <span className="person-avatar coral">VO</span>
                <div><strong>Vos</strong><small>{yourSlots.length} horarios disponibles</small></div>
                <span className="check">✓</span>
              </div>}
              {activeGathering?.participants.map((participant, index) => {
                const availableCount = participant.id === participantSession?.participantId
                  ? yourSlots.length
                  : participant.availabilities?.filter(
                      (availability) => availability.kind === "AVAILABLE",
                    ).length ?? 0;
                const colors = ["peach", "blue", "purple", "green", "yellow", "coral"];
                return (
                  <div className="friend-row" key={participant.id}>
                    <ParticipantAvatar
                      name={participant.name}
                      avatarUrl={participant.avatarUrl}
                      color={colors[index % colors.length]}
                    />
                    <div>
                      <strong>
                        {participant.name}
                        {participant.id === participantSession?.participantId ? " (vos)" : ""}
                      </strong>
                      <small>
                        {availableCount > 0
                          ? `${availableCount} horarios disponibles`
                          : "Todavía no respondió"}
                      </small>
                    </div>
                    <span className={availableCount > 0 ? "check" : "pending"}>
                      {availableCount > 0 ? "✓" : "·"}
                    </span>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>

        <button className="find-button" onClick={findBestMoment}>
          <SparkIcon /> Encontrar el mejor momento
        </button>
        <p className="find-caption">Analizamos todas las disponibilidades y te damos las mejores opciones.</p>

        {confirmed && (
          <PurchasePlanner
            gatheringKey={activeGathering?.id ?? "demo"}
            participantCount={activeGathering?.participants.length ?? 6}
            onNotice={(message) => {
              setNotice(message);
              window.setTimeout(() => setNotice(""), 2800);
            }}
          />
        )}

        {activeGathering && (
          <section className="expenses-section" id="gastos">
            <div className="expenses-heading">
              <div>
                <span className="section-kicker">CUENTAS CLARAS</span>
                <h2>Dividir gastos sin calculadora.</h2>
                <p>
                  Cada uno carga lo que pagó. Dividimos el total entre las{" "}
                  {activeGathering.participants.length} personas y evitamos
                  transferencias innecesarias.
                </p>
              </div>
              <div className="expense-total">
                <span>Total gastado</span>
                <strong>{formatMoney(expenseSettlement?.totalCents ?? 0)}</strong>
                <small>
                  {formatMoney(expenseSettlement?.averageCents ?? 0)} por persona
                </small>
              </div>
            </div>

            <div className="live-collaboration" aria-live="polite">
              <span className="live-dot" />
              <strong>
                {liveMembers.length > 0
                  ? `${liveMembers.length} ${liveMembers.length === 1 ? "persona conectada" : "personas conectadas"}`
                  : isLiveConnected
                    ? "Mirando actividad en vivo"
                    : "Conectando al grupo…"}
              </strong>
              {liveMembers.length > 0 && (
                <span>{listNames(liveMembers.map((member) => member.name))}</span>
              )}
              {typingMembers.map((member) => (
                <em key={`typing-${member.participantId}`}>
                  {member.name} está cargando un gasto…
                </em>
              ))}
              {analyzingMembers.map((member) => (
                <em key={`analysis-${member.participantId}`}>
                  {member.name} está analizando horarios…
                </em>
              ))}
            </div>

            {(expenseSettlement?.expenses.length ?? 0) > 0 && (
              <div
                className={`expense-closing ${expenseSettlement?.allReady ? "ready" : ""}`}
              >
                <div className="closing-progress">
                  <span>
                    RONDA {expenseSettlement?.expenseRound ?? 1}
                    {(expenseSettlement?.expenseRound ?? 1) > 1 ? " · AJUSTE" : ""}
                  </span>
                  <strong>
                    {expenseSettlement?.allReady
                      ? "Cuentas cerradas: ya pueden transferir"
                      : "Esperando que todos terminen de cargar"}
                  </strong>
                  <p>
                    {expenseSettlement?.allReady
                      ? "La división quedó congelada. Si aparece un gasto tarde, calcularemos solamente la diferencia."
                      : `${expenseSettlement?.readyParticipants.length ?? 0}/${expenseSettlement?.participantCount ?? 0} confirmaron. Faltan ${listNames(expenseSettlement?.pendingReadyParticipants.map((participant) => participant.name) ?? [])}.`}
                  </p>
                </div>
                {!currentParticipant ? (
                  <span className="ready-confirmation">👀 Modo espectador</span>
                ) : currentParticipantExpensesReady ? (
                  <span className="ready-confirmation">✓ Ya confirmaste</span>
                ) : (
                  <button
                    type="button"
                    onClick={markExpensesReady}
                    disabled={isMarkingExpensesReady}
                  >
                    {isMarkingExpensesReady
                      ? "Confirmando…"
                      : "Ya cargué todos mis gastos"}
                  </button>
                )}
              </div>
            )}

            <div className="expenses-grid">
              <div className="expense-entry-card">
                <h3>Cargar un gasto</h3>
                <p>
                  {currentParticipant
                    ? `Lo registramos como pagado por ${currentParticipant.name}.`
                    : "Entrá con tu nombre para registrar lo que pagaste."}
                </p>
                <form className="expense-form" onSubmit={addExpense}>
                  <label>
                    Concepto
                    <input
                      name="expenseDescription"
                      placeholder="Ej. Carne, bebidas, taxi"
                      minLength={2}
                      maxLength={80}
                      onChange={signalExpenseTyping}
                      required
                    />
                  </label>
                  <label>
                    Monto
                    <div className="money-input">
                      <span>$</span>
                      <input
                        name="expenseAmount"
                        type="text"
                        inputMode="numeric"
                        value={expenseAmount}
                        onChange={(event) => {
                          setExpenseAmount(formatThousands(event.target.value));
                          signalExpenseTyping();
                        }}
                        placeholder="0"
                        required
                      />
                    </div>
                  </label>
                  <button
                    className="primary-button full"
                    type="submit"
                    disabled={isSavingExpense}
                  >
                    {isSavingExpense ? "Calculando…" : "Agregar y recalcular"}
                  </button>
                </form>

                <div className="expense-history">
                  <strong>Gastos cargados</strong>
                  {(expenseSettlement?.expenses.length ?? 0) === 0 && (
                    <p className="empty-expenses">Todavía no cargaron gastos.</p>
                  )}
                  {expenseSettlement?.expenses.map((expense) => (
                    <div className="expense-row" key={expense.id}>
                      <ParticipantAvatar
                        name={expense.paidBy.name}
                        avatarUrl={expense.paidBy.avatarUrl}
                        color="peach"
                      />
                      <div>
                        <strong>{expense.description}</strong>
                        <small>Pagó {expense.paidBy.name}</small>
                      </div>
                      <b>{formatMoney(expense.amountCents)}</b>
                    </div>
                  ))}
                </div>
              </div>

              <div className="settlement-card">
                <div className="settlement-title">
                  <div>
                    <span><SparkIcon /> DIVISIÓN AUTOMÁTICA</span>
                    <h3>Quién transfiere a quién</h3>
                  </div>
                  <span className="transfer-count">
                    {expenseSettlement?.allReady
                      ? `${expenseSettlement?.transfers.length ?? 0} pendientes`
                      : "Estimación"}
                  </span>
                </div>

                {(expenseSettlement?.expenses.length ?? 0) === 0 && (
                  <div className="settlement-empty">
                    <span>↗</span>
                    <strong>Acá aparecerá la división</strong>
                    <p>Con el primer gasto calculamos automáticamente quién paga y quién recibe.</p>
                  </div>
                )}
                {(expenseSettlement?.expenses.length ?? 0) > 0 &&
                  expenseSettlement?.transfers.length === 0 && (
                    <div className="settlement-empty settled">
                      <span>✓</span>
                      <strong>Ya están a mano</strong>
                      <p>No hace falta realizar ninguna transferencia.</p>
                    </div>
                  )}
                {(expenseSettlement?.expenses.length ?? 0) > 0 &&
                  !expenseSettlement?.allReady &&
                  (expenseSettlement?.transfers.length ?? 0) > 0 && (
                    <div className="transfer-lock">
                      <span>🔒</span>
                      <div>
                        <strong>División preliminar</strong>
                        <p>Las transferencias se habilitan cuando todos confirmen que terminaron de cargar.</p>
                      </div>
                    </div>
                  )}
                {expenseSettlement?.transfers.map((transfer) => (
                  <div
                    className={`transfer-row ${transfer.settled ? "settled" : ""}`}
                    key={transfer.id}
                  >
                    <ParticipantAvatar
                      name={transfer.fromName}
                      avatarUrl={activeGathering.participants.find(
                        (participant) => participant.id === transfer.fromParticipantId,
                      )?.avatarUrl}
                      color="coral"
                    />
                    <div>
                      <strong>{transfer.fromName}</strong>
                      <small>le transfiere a {transfer.toName}</small>
                    </div>
                    <b>{formatMoney(transfer.amountCents)}</b>
                    <span className="transfer-arrow">→</span>
                    <ParticipantAvatar
                      name={transfer.toName}
                      avatarUrl={activeGathering.participants.find(
                        (participant) => participant.id === transfer.toParticipantId,
                      )?.avatarUrl}
                      color="green"
                    />
                    <div className="transfer-state">
                      {expenseSettlement.allReady &&
                      transfer.fromParticipantId === currentParticipant?.id ? (
                        <button
                          type="button"
                          onClick={() => confirmTransferPayment(transfer)}
                        >
                          Marcar como transferido
                        </button>
                      ) : (
                        <span className="pending-transfer">
                          {expenseSettlement.allReady ? "Pendiente" : "A confirmar"}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {(expenseSettlement?.completedTransfers.length ?? 0) > 0 && (
                  <div className="completed-transfers">
                    <strong>Transferencias ya realizadas</strong>
                    {expenseSettlement?.completedTransfers.map((transfer) => (
                      <div key={transfer.id}>
                        <span>✓ {transfer.fromName} → {transfer.toName}</span>
                        <b>{formatMoney(transfer.amountCents)}</b>
                      </div>
                    ))}
                  </div>
                )}
                {(expenseSettlement?.balances.length ?? 0) > 0 && (
                  <div className="balance-note">
                    El reparto contempla centavos para que el total cierre exactamente.
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </section>

      <section className="steps-section">
        <span className="section-kicker">ASÍ DE SIMPLE</span>
        <h2>Del “vemos” al “nos vemos”.</h2>
        <div className="steps-grid">
          <article><span>01</span><div className="step-icon">＋</div><h3>Creá la juntada</h3><p>Elegí un rango de fechas y compartí el link en el grupo.</p></article>
          <article><span>02</span><div className="step-icon">✓</div><h3>Cada uno responde</h3><p>Sin registros ni descargas. En menos de un minuto.</p></article>
          <article><span>03</span><div className="step-icon">✦</div><h3>Encontramos el match</h3><p>Ordenamos las mejores opciones y ustedes confirman.</p></article>
        </div>
      </section>

      {supportAlias && (
        <aside className="support-card">
          <div className="support-emoji" aria-hidden="true">🍺</div>
          <div>
            <span>VOLUNTAD TOTALMENTE OPCIONAL</span>
            <h2>¿Te ahorramos 84 mensajes?</h2>
            <p>Si Sale Juntada te salvó el plan, podés invitarme una birrita de onda.</p>
          </div>
          <div className="support-alias">
            <small>Alias</small>
            <strong>{supportAlias}</strong>
            <button type="button" onClick={copySupportAlias}>Copiar alias</button>
          </div>
        </aside>
      )}

      <footer>
        <a className="brand" href="#inicio"><span className="brand-mark"><SparkIcon /></span><span>Sale Juntada</span></a>
        <p>Hecho para que los planes salgan.</p>
        <span>Argentina · 2026</span>
      </footer>

      <MobileBottomNav
        purchaseEnabled={Boolean(confirmed)}
        onHome={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        onAvailability={() => document.getElementById("disponibilidad")?.scrollIntoView({ behavior: "smooth" })}
        onPurchase={() => {
          if (confirmed) {
            document.getElementById("compra")?.scrollIntoView({ behavior: "smooth" });
            return;
          }
          setNotice("La compra se habilita cuando el organizador confirma una fecha.");
          window.setTimeout(() => setNotice(""), 2800);
        }}
        onMore={() => document.querySelector(".support-card, footer")?.scrollIntoView({ behavior: "smooth" })}
      />

      {showResults && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowResults(false)}>
          <section className="results-sheet" role="dialog" aria-modal="true" aria-labelledby="results-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="close-button" onClick={() => setShowResults(false)} aria-label="Cerrar">×</button>
            <span className="eyebrow"><SparkIcon /> Análisis listo</span>
            <h2 id="results-title">¿Qué falta para que salga?</h2>
            <p>Te mostramos la mejor opción, el bloqueo y el cambio más corto para resolverlo.</p>
            {activeGathering && resultAnalysis && (
              <section className="result-analysis" aria-label="Diagnóstico del grupo">
                <div className="analysis-icon"><SparkIcon /></div>
                <div className="analysis-copy">
                  <span>DIAGNÓSTICO</span>
                  <h3>{resultAnalysis.title}</h3>
                  <p>{resultAnalysis.detail}</p>
                </div>
                <div className="analysis-action">
                  <strong>Qué haría ahora</strong>
                  <p>{resultAnalysis.action}</p>
                </div>
              </section>
            )}
            {activeGathering && matches.length > 0 && (
              <div className="alternatives-heading">
                <strong>Horarios para proponer</strong>
                <span>De menor a mayor esfuerzo</span>
              </div>
            )}
            <div className="proposal-list">
              {activeGathering && matches.length === 0 && (
                <div className="empty-results">
                  Todavía no hay disponibilidades cargadas. Compartí el link para
                  que el grupo responda.
                </div>
              )}
              {!activeGathering && rankedSlots.slice(0, 3).map((slot, index) => (
                <article className={`proposal ${index === 0 ? "best" : ""}`} key={slot.id}>
                  <div className="proposal-rank">{index + 1}</div>
                  <div className="proposal-date">
                    <strong>{slot.day} {slot.date}</strong>
                    <span>{slot.time} · {location}</span>
                  </div>
                  <div className="proposal-score">
                    <strong>{slot.available}/6</strong>
                    <span>{slot.missing === 0 ? "Pueden todos" : `Falta ${slot.missing}`}</span>
                  </div>
                  <button onClick={() => confirmProposal(slot.id)}>Elegir</button>
                </article>
              ))}
              {activeGathering && matches.map((match, index) => {
                const startsAt = new Date(match.startsAt);
                const pendingNames = match.pendingParticipantNames ?? [];
                const conflictNames = match.conflictParticipantNames ?? [];
                const availableNames = match.availableParticipantNames ?? [];
                const dateLabel = new Intl.DateTimeFormat("es-AR", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                }).format(startsAt);
                const timeLabel = new Intl.DateTimeFormat("es-AR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                }).format(startsAt);

                return (
                  <article
                    className={`proposal ${index === 0 ? "best" : ""}`}
                    key={match.startsAt}
                  >
                    <div className="proposal-rank">{index + 1}</div>
                    <div className="proposal-date">
                      <strong>{dateLabel}</strong>
                      <span>{timeLabel} · {location}</span>
                    </div>
                    <div className="proposal-score">
                      <strong>{match.available}/{match.total}</strong>
                      <span>{index === 0 ? "Mejor opción" : match.explanation}</span>
                    </div>
                    <div className="proposal-breakdown">
                      <span className="can-attend">
                        ✓ Pueden: {availableNames.length > 0
                          ? listNames(availableNames)
                          : "todavía nadie"}
                      </span>
                      {match.missing === 0 && (
                        <span className="all-attend">Listo: no hay que mover a nadie.</span>
                      )}
                      {pendingNames.length > 0 && (
                        <span className="waiting-on">
                          Esperando respuesta de {listNames(pendingNames)}.
                        </span>
                      )}
                      {conflictNames.length > 0 && (
                        <span className="needs-change">
                          Para llegar a {match.total}/{match.total}, {listNames(conflictNames)}
                          {conflictNames.length === 1 ? " tendría" : " tendrían"} que mover su disponibilidad.
                        </span>
                      )}
                    </div>
                    {currentParticipant?.isOrganizer && (
                      <button
                        type="button"
                        className="proposal-confirm"
                        onClick={() => confirmProposal(match.startsAt)}
                      >
                        Confirmar esta fecha
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {showCreate && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowCreate(false)}>
          <form className="create-sheet" onSubmit={createEvent} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="close-button" onClick={() => setShowCreate(false)} aria-label="Cerrar">×</button>
            <span className="eyebrow"><SparkIcon /> Nueva juntada</span>
            <h2>¿Qué plan tienen?</h2>
            <p>Con lo básico alcanza. Después el grupo completa el resto.</p>
            <label>
              Nombre de la juntada
              <input name="title" defaultValue={eventName} placeholder="Ej. Asado, birras, fulbito..." required />
            </label>
            <label>
              Tu nombre
              <input
                name="organizerName"
                defaultValue=""
                placeholder="Ej. Tomás"
                minLength={2}
                required
              />
            </label>
            <fieldset className="avatar-picker">
              <legend>Elegí tu personaje</legend>
              <div className="avatar-options">
                {avatarPresets.map((emoji) => {
                  const value = `emoji:${emoji}`;
                  return (
                    <button
                      type="button"
                      className={selectedAvatar === value ? "selected" : ""}
                      aria-label={`Usar ${emoji} como avatar`}
                      aria-pressed={selectedAvatar === value}
                      onClick={() => setSelectedAvatar(value)}
                      key={emoji}
                    >
                      {emoji}
                    </button>
                  );
                })}
                <label className="photo-avatar-option">
                  {selectedAvatar.startsWith("data:")
                    ? <img src={selectedAvatar} alt="Tu foto elegida" />
                    : <span>📷</span>}
                  <small>{isPreparingAvatar ? "Preparando…" : "Tu foto"}</small>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isPreparingAvatar}
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      setIsPreparingAvatar(true);
                      setApiError("");
                      try {
                        setSelectedAvatar(await makeAvatarThumbnail(file));
                      } catch (error) {
                        setApiError(
                          error instanceof Error
                            ? error.message
                            : "No pudimos preparar esa foto.",
                        );
                      } finally {
                        setIsPreparingAvatar(false);
                      }
                    }}
                  />
                </label>
              </div>
              <small>La foto se recorta y comprime antes de guardarse.</small>
            </fieldset>
            <section className="schedule-builder location-builder">
              <div className="schedule-heading">
                <div>
                  <strong>¿Dónde sería?</strong>
                  <small>Buscá el lugar y ajustá el pin si hace falta.</small>
                </div>
                <span>📍</span>
              </div>
              <LocationPicker
                value={selectedLocation}
                onChange={setSelectedLocation}
              />
            </section>
            <section className="schedule-builder">
              <div className="schedule-heading">
                <div>
                  <strong>¿Qué días buscamos?</strong>
                  <small>Elegí el período que querés consultar.</small>
                </div>
                <span>1</span>
              </div>
              <div className="form-row">
                <label>
                  Desde
                  <input
                    name="from"
                    type="date"
                    min={dateInputValue(new Date())}
                    value={createFrom}
                    onChange={(event) => {
                      const value = event.target.value;
                      setCreateFrom(value);
                      if (createTo < value) setCreateTo(value);
                    }}
                    required
                  />
                </label>
                <label>
                  Hasta
                  <input
                    name="to"
                    type="date"
                    min={createFrom}
                    value={createTo}
                    onChange={(event) => setCreateTo(event.target.value)}
                    required
                  />
                </label>
              </div>
            </section>
            <section className="schedule-builder">
              <div className="schedule-heading">
                <div>
                  <strong>¿En qué horario?</strong>
                  <small>No mostraremos opciones fuera de esta franja.</small>
                </div>
                <span>2</span>
              </div>
              <div className="time-presets" aria-label="Franjas sugeridas">
                {timeWindowPresets.map((preset) => {
                  const selected =
                    createStartTime === preset.start &&
                    createEndTime === preset.end;
                  return (
                    <button
                      type="button"
                      className={selected ? "selected" : ""}
                      aria-pressed={selected}
                      onClick={() => {
                        setCreateStartTime(preset.start);
                        setCreateEndTime(preset.end);
                      }}
                      key={preset.label}
                    >
                      <span>{preset.icon}</span>
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              <div className="form-row time-range-row">
                <label>
                  Desde las
                  <input
                    type="time"
                    value={createStartTime}
                    onChange={(event) => setCreateStartTime(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Hasta las
                  <input
                    type="time"
                    value={createEndTime}
                    onChange={(event) => setCreateEndTime(event.target.value)}
                    required
                  />
                </label>
              </div>
              {createSchedulePreview.overnight && (
                <small className="overnight-note">
                  🌙 Termina al día siguiente.
                </small>
              )}
              <label>
                ¿Cuánto debería durar?
                <select
                  value={createDuration}
                  onChange={(event) => setCreateDuration(Number(event.target.value))}
                >
                  <option value={60}>1 hora</option>
                  <option value={120}>2 horas</option>
                  <option value={180}>3 horas</option>
                  <option value={240}>4 horas</option>
                  <option value={300}>5 horas</option>
                </select>
              </label>
            </section>
            <div
              className={`schedule-preview ${
                createSchedulePreview.totalOptions === 0 ? "invalid" : ""
              }`}
            >
              <span aria-hidden="true">✨</span>
              <div>
                <strong>
                  {createSchedulePreview.totalOptions > 0
                    ? `${createSchedulePreview.totalOptions} horarios posibles`
                    : "La franja es demasiado corta"}
                </strong>
                <small>
                  {createSchedulePreview.dayCount} días · opciones cada 1 hora ·
                  duración de {createDuration / 60} h
                </small>
              </div>
            </div>
            {apiError && <small className="form-error" role="alert">{apiError}</small>}
            <button
              className="primary-button full"
              type="submit"
              disabled={
                isSubmitting ||
                isPreparingAvatar ||
                createSchedulePreview.totalOptions === 0
              }
            >
              {isSubmitting ? "Creando…" : "Crear y elegir horarios"} <span>→</span>
            </button>
            <small className="privacy-note">Nadie necesita registrarse para responder.</small>
          </form>
        </div>
      )}

      {showJoin && activeGathering && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setShowJoin(false)}
        >
          <form
            className="create-sheet"
            onSubmit={joinGathering}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="close-button"
              onClick={() => setShowJoin(false)}
              aria-label="Cerrar"
            >
              ×
            </button>
            <span className="eyebrow"><SparkIcon /> Te invitaron</span>
            <h2>Sumate a “{activeGathering.title}”</h2>
            <p>
              Decinos cómo te llamás para guardar tu disponibilidad. No hace
              falta crear una cuenta.
            </p>
            <label>
              Tu nombre
              <input
                name="participantName"
                placeholder="Ej. Sofi"
                minLength={2}
                autoFocus
                required
              />
            </label>
            <fieldset className="avatar-picker">
              <legend>Elegí tu personaje</legend>
              <div className="avatar-options">
                {avatarPresets.map((emoji) => {
                  const value = `emoji:${emoji}`;
                  return (
                    <button
                      type="button"
                      className={selectedAvatar === value ? "selected" : ""}
                      aria-label={`Usar ${emoji} como avatar`}
                      aria-pressed={selectedAvatar === value}
                      onClick={() => setSelectedAvatar(value)}
                      key={emoji}
                    >
                      {emoji}
                    </button>
                  );
                })}
                <label className="photo-avatar-option">
                  {selectedAvatar.startsWith("data:")
                    ? <img src={selectedAvatar} alt="Tu foto elegida" />
                    : <span>📷</span>}
                  <small>{isPreparingAvatar ? "Preparando…" : "Tu foto"}</small>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isPreparingAvatar}
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      setIsPreparingAvatar(true);
                      setApiError("");
                      try {
                        setSelectedAvatar(await makeAvatarThumbnail(file));
                      } catch (error) {
                        setApiError(
                          error instanceof Error
                            ? error.message
                            : "No pudimos preparar esa foto.",
                        );
                      } finally {
                        setIsPreparingAvatar(false);
                      }
                    }}
                  />
                </label>
              </div>
              <small>La foto se recorta y comprime antes de guardarse.</small>
            </fieldset>
            {apiError && <small className="form-error" role="alert">{apiError}</small>}
            <button
              className="primary-button full"
              type="submit"
              disabled={isSubmitting || isPreparingAvatar}
            >
              {isSubmitting ? "Sumándote…" : "Entrar y marcar horarios"} <span>→</span>
            </button>
            {googleClientId && (
              <>
                <div className="join-divider"><span>o recuperá tu perfil</span></div>
                <div className="google-signin" ref={googleButtonRef} />
              </>
            )}
            <small className="privacy-note">
              Sin cuenta queda en este dispositivo. Con Google también podés
              recuperarla desde otro.
            </small>
          </form>
        </div>
      )}

      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
