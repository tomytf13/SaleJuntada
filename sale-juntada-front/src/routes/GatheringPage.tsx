import { ParticipantProfileEditor } from "../components/ParticipantProfileEditor";
import { GatheringDatePlace } from "../components/GatheringDatePlace";
import { PublicInvitation } from "./PublicInvitation";
import { normalizeContactPhone } from "../utils/phone";
import { GatheringServiceSettings } from "../components/GatheringServiceSettings";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
} from "react";
import { AnimatePresence, m } from "framer-motion";
import { Link, NavLink, useNavigate, useParams } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import {
  ApiError,
  Expense,
  ExpenseSettlement,
  GatheringHistoryItem,
  gatheringService,
  Match,
  PaymentDetails,
  SOCKET_URL,
  UpdateGatheringInput,
} from "../services/gatheringService";
import { PurchasePlanner } from "../components/MobileExperience";
import { AnimatedDialog } from "../components/AnimatedDialog";
import { AnimatedToast } from "../components/AnimatedToast";
import { AccountDialog } from "../components/AccountDialog";

import { PaymentAliasEditor } from "../components/PaymentAliasEditor";
import { PwaStatus } from "../components/PwaStatus";
import { GatheringManagementDialog } from "../components/GatheringManagementDialog";
import { ParticipantAvatar } from "../components/ParticipantAvatar";
import { SparkIcon } from "../components/SparkIcon";
import {
  CreateGatheringDialog,
  type CreateGatheringPrefill,
} from "../components/CreateGatheringDialog";
import { useAuth } from "../auth/useAuth";
import { useGathering } from "../hooks/useGathering";
import { useRsvp } from "../hooks/useRsvp";
import { GatheringHero } from "../components/GatheringHero";
import { JoinGathering } from "../components/JoinGathering";
import { RsvpSelector } from "../components/RsvpSelector";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GatheringChecklist } from "../components/GatheringChecklist";
import { checklistKey } from "../hooks/queryKeys";
import { AttendanceSummary } from "../components/AttendanceSummary";
import { GatheringDraftContext } from "../hooks/useGatheringDraft";
import { GatheringNavigation } from "../components/GatheringNavigation";
import {
  GatheringHome,
  GatheringPersonalTasks,
  GatheringServices,
} from "../components/GatheringOverview";
import { DietaryPlanner } from "../components/DietaryPlanner";
import {
  gatheringModuleTitle,
  isGatheringServiceEnabled,
} from "../utils/gatheringModules";
import { formatAvailabilitySummary } from "../utils/availability";
import {
  dateInputValue,
  decorateSlot,
  formatMoney,
  formatThousands,
  initials,
  listNames,
  readParticipantSession,
  storeParticipantSession,
  timeFromMinutes,
  type ParticipantSession,
  type Slot,
} from "../utils/gatheringHelpers";
import {
  listItemVariants,
  listVariants,
  quickTransition,
  springTransition,
  standardTransition,
} from "../motion/config";
import { NotFoundGathering } from "./NotFoundGathering";
import { GatheringSkeleton } from "./GatheringSkeleton";

const PartyGames = lazy(() =>
  import("../components/PartyGames").then((module) => ({
    default: module.PartyGames,
  })),
);

export default function GatheringPage() {
  const { user, accessToken, isLoading } = useAuth();
  const { slug } = useParams();
  if (isLoading) return <GatheringSkeleton />;
  return user && accessToken
    ? <AccountGathering key={`${slug}:${user.id}`} />
    : <PublicInvitation />;
}

function AccountGathering() {
  const [drafts] = useState(() => new Map<string, unknown>());
  return (
    <GatheringDraftContext.Provider value={drafts}>
      <GatheringWorkspace />
    </GatheringDraftContext.Provider>
  );
}

function GatheringWorkspace() {
  const { slug: rawSlug } = useParams<{ slug: string }>();
  const slug = rawSlug ?? "";
  const { "*": modulePath = "" } = useParams();
  const view = modulePath.replace(/\/$/, "");
  const basePath = `/j/${slug}`;
  const isAccounts = view === "cuentas" || view === "cuentas/transferencias";
  const moduleHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    window.scrollTo({ top: 0 });
    moduleHeadingRef.current?.focus({ preventScroll: true });
  }, [view]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, accessToken, isLoading: isLoadingAuth } = useAuth();
  const [yourSlots, setYourSlots] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createPrefill, setCreatePrefill] =
    useState<CreateGatheringPrefill | null>(null);
  const [createDialogKey, setCreateDialogKey] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [notice, setNotice] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);
  const [apiError, setApiError] = useState("");
  const [showJoin, setShowJoin] = useState(false);
  const [duplicateNameWarning, setDuplicateNameWarning] = useState("");
  const [showAccount, setShowAccount] = useState(false);
  const [participantSession, setParticipantSession] =
    useState<ParticipantSession | null>(() => readParticipantSession(slug));
  const [authorizedSession, setAuthorizedSession] = useState<ParticipantSession | null>(null);
  const gatheringQuery = useGathering(slug, authorizedSession?.responseToken);
  const {
    gathering: activeGathering,
    setGathering: setActiveGathering,
    refresh: refreshGathering,
  } = gatheringQuery;
  const rsvp = useRsvp(slug, activeGathering?.id, authorizedSession);
  const eventName = activeGathering?.title ?? "";
  const location =
    activeGathering?.finalizedLocation ??
    activeGathering?.locationHint ??
    "Lugar a definir";
  const isLoadingGathering = gatheringQuery.isPending;
  const notFound =
    gatheringQuery.error instanceof ApiError &&
    gatheringQuery.error.status === 404;
  const [expenseSettlement, setExpenseSettlement] =
    useState<ExpenseSettlement | null>(null);
  const [expensesLoadError, setExpensesLoadError] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(
    null,
  );
  const [isSavingPaymentAlias, setIsSavingPaymentAlias] = useState(false);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [isMarkingExpensesReady, setIsMarkingExpensesReady] = useState(false);
  const [isConfirmingGathering, setIsConfirmingGathering] = useState(false);
  const [showManageGathering, setShowManageGathering] = useState(false);
  const [isManagingGathering, setIsManagingGathering] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseEditDescription, setExpenseEditDescription] = useState("");
  const [expenseEditAmount, setExpenseEditAmount] = useState("");
  const [isUpdatingExpense, setIsUpdatingExpense] = useState(false);
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
  const [purchaseRevision, setPurchaseRevision] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  /** Última juntada conocida, para leer dentro de handlers del socket sin
   * que ese valor dispare una reconexión (ver el efecto del socket, abajo). */
  const activeGatheringRef = useRef(activeGathering);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Clave del gasto que se está intentando cargar. Sobrevive a los
   * reintentos y se descarta recién cuando el gasto quedó guardado. */
  const expenseIdempotencyKeyRef = useRef<string | null>(null);
  const saveAvailabilityTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  /** Última selección que confirmó el servidor; es el punto al que se
   * revierte si falla un guardado. */
  const savedSlotsRef = useRef<string[]>([]);
  const availabilityGridRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    activeGatheringRef.current = activeGathering;
  }, [activeGathering]);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  }, []);

  const scrollAvailabilityDays = (direction: -1 | 1) => {
    const grid = availabilityGridRef.current;
    if (!grid) return;
    const day = grid.querySelector<HTMLElement>(".day-slot-group");
    const distance = day ? day.offsetWidth + 9 : grid.clientWidth;
    grid.scrollBy({ left: direction * distance, behavior: "smooth" });
  };
  const authName = String(
    user?.user_metadata.full_name ??
      user?.user_metadata.name ??
      user?.email?.split("@")[0] ??
      "Tu cuenta",
  );
  const authAvatarValue =
    user?.user_metadata.avatar_url ?? user?.user_metadata.picture;
  const authAvatarUrl =
    typeof authAvatarValue === "string" ? authAvatarValue : null;

  const openGatheringFromHistory = (item: GatheringHistoryItem) => {
    storeParticipantSession(
      item.slug,
      item.participant.id,
      item.participant.responseToken,
    );
    setShowAccount(false);
    navigate(`/j/${item.slug}`);
  };

  const duplicateGathering = async (item: GatheringHistoryItem) => {
    setApiError("");
    try {
      const source = await gatheringService.getBySlug(item.slug);
      const sourceStart = new Date(source.windowStart);
      const sourceEnd = new Date(source.windowEnd);
      if ((source.dailyEndMinutes ?? 1440) >= 1440) {
        sourceEnd.setDate(sourceEnd.getDate() - 1);
      }
      const daySpan = Math.max(
        0,
        Math.round(
          (new Date(dateInputValue(sourceEnd)).getTime() -
            new Date(dateInputValue(sourceStart)).getTime()) /
            86_400_000,
        ),
      );
      const nextStart = new Date();
      nextStart.setDate(nextStart.getDate() + 1);
      const nextEnd = new Date(nextStart);
      nextEnd.setDate(nextEnd.getDate() + daySpan);

      setCreatePrefill({
        templateGatheringId: source.id,
        title: source.title,
        from: dateInputValue(nextStart),
        to: dateInputValue(nextEnd),
        startTime: timeFromMinutes(source.dailyStartMinutes ?? 780),
        endTime: timeFromMinutes(source.dailyEndMinutes ?? 1440),
        duration: source.durationMinutes,
        location:
          source.locationHint &&
          source.locationLatitude != null &&
          source.locationLongitude != null
            ? {
                label: source.locationHint,
                latitude: source.locationLatitude,
                longitude: source.locationLongitude,
              }
            : null,
      });
      setCreateDialogKey((key) => key + 1);
      setShowAccount(false);
      setShowCreate(true);
      showNotice("Copiamos la configuración. Revisá las nuevas fechas.");
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : "No pudimos preparar la copia.",
      );
      setShowAccount(false);
    }
  };

  /** Selección que viene del servidor: es el punto al que se revierte. */
  const setAvailabilitySelection = (next: string[]) => {
    setYourSlots(next);
    savedSlotsRef.current = next;
  };

  useEffect(
    () => () => {
      if (saveAvailabilityTimeoutRef.current) {
        clearTimeout(saveAvailabilityTimeoutRef.current);
      }
    },
    [],
  );

  const slots = useMemo(() => {
    if (!activeGathering) return [];
    return (activeGathering.slots ?? []).map((slot) =>
      decorateSlot(slot, activeGathering.timeZone),
    );
  }, [activeGathering]);
  const slotGroups = useMemo(() => {
    const groups = new Map<
      string,
      { day: string; date: string; slots: Slot[] }
    >();
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

  const activeGatheringId = activeGathering?.id;
  const sessionParticipantId = participantSession?.participantId;
  const sessionResponseToken = participantSession?.responseToken;
  const isParticipant = Boolean(authorizedSession && activeGathering?.isParticipant);
  const checklistQuery = useQuery({
    queryKey: checklistKey(activeGatheringId ?? "", sessionResponseToken ?? ""),
    queryFn: () =>
      gatheringService.getChecklist(activeGatheringId!, sessionResponseToken!),
    enabled: Boolean(
      activeGatheringId && isParticipant && sessionResponseToken,
    ),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!activeGathering || isSavingAvailability) return;
    const participant = activeGathering.participants.find(
      (p) => p.id === sessionParticipantId,
    );
    const next =
      participant?.availabilities
        ?.filter((a) => a.kind === "AVAILABLE")
        .map((a) => a.startsAt) ?? [];
    if (next.join("|") !== savedSlotsRef.current.join("|"))
      setAvailabilitySelection(next);
  }, [activeGathering, sessionParticipantId, isSavingAvailability]);

  useEffect(() => {
    if (!activeGatheringId || !isParticipant || !sessionResponseToken) return;
    let cancelled = false;
    const participant = activeGatheringRef.current?.participants.find(
      (p) => p.id === sessionParticipantId,
    );
    setAvailabilitySelection(
      participant?.availabilities
        ?.filter((a) => a.kind === "AVAILABLE")
        .map((a) => a.startsAt) ?? [],
    );
    void Promise.allSettled([
      gatheringService.getMatches(activeGatheringId, sessionResponseToken),
      gatheringService.getExpenseSettlement(
        activeGatheringId,
        sessionResponseToken,
      ),
    ]).then(([matchResult, expensesResult]) => {
      if (cancelled) return;
      setMatches(matchResult.status === "fulfilled" ? matchResult.value : []);
      setExpensesLoadError(expensesResult.status === "rejected");
      setExpenseSettlement(
        expensesResult.status === "fulfilled" ? expensesResult.value : null,
      );
    });
    return () => {
      cancelled = true;
    };
  }, [
    activeGatheringId,
    isParticipant,
    sessionParticipantId,
    sessionResponseToken,
  ]);

  useEffect(() => {
    if (
      !activeGatheringId ||
      !sessionParticipantId ||
      !sessionResponseToken ||
      !accessToken
    )
      return;
    void gatheringService
      .linkAuthenticatedParticipant(
        activeGatheringId,
        sessionParticipantId,
        sessionResponseToken,
        accessToken,
      )
      .then((participant) => {
        if (!participant.responseToken) return;
        const session = { participantId: participant.id, responseToken: participant.responseToken };
        storeParticipantSession(slug, session.participantId, session.responseToken);
        setAuthorizedSession(session);
        if (session.participantId !== sessionParticipantId || session.responseToken !== sessionResponseToken) setParticipantSession(session);
      })
      .catch(() => {
        setAuthorizedSession(null);
        setParticipantSession(null);
        setApiError("Ingresá desde Mis juntadas para recuperar tu participación, o aceptá la invitación con esta cuenta.");
      });
  }, [
    accessToken,
    activeGatheringId,
    sessionParticipantId,
    sessionResponseToken,
    slug,
  ]);

  useEffect(() => {
    if (
      !activeGatheringId ||
      !sessionParticipantId ||
      !sessionResponseToken ||
      !isParticipant
    ) {
      return;
    }
    let cancelled = false;
    void gatheringService
      .getPaymentDetails(
        activeGatheringId,
        sessionParticipantId,
        sessionResponseToken,
      )
      .then((details) => {
        if (!cancelled) setPaymentDetails(details);
      })
      .catch(() => {
        if (!cancelled) setPaymentDetails(null);
      });
    return () => {
      cancelled = true;
    };
  }, [
    activeGatheringId,
    expenseSettlement?.allReady,
    isParticipant,
    sessionParticipantId,
    sessionResponseToken,
  ]);

  // El socket depende únicamente de identificadores estables, no del objeto
  // `activeGathering` completo. Antes dependía de ese objeto, y como cada
  // mutación (guardar disponibilidad, cargar un gasto, etc.) reemplaza esa
  // referencia, la conexión se cerraba y se volvía a abrir en cada cambio: la
  // presencia parpadeaba y los avisos en vuelo ("Sofi está cargando...") se
  // perdían a mitad de camino. Los handlers leen la juntada actual a través
  // de `activeGatheringRef`, que se mantiene al día sin disparar el efecto.
  useEffect(() => {
    // El tiempo real ya no es público: la sala de una juntada exige la
    // misma credencial que la API. Sin sesión no se abre el socket.
    if (
      !activeGatheringId ||
      !sessionParticipantId ||
      !sessionResponseToken ||
      !isParticipant
    ) {
      return;
    }

    const currentParticipant = () =>
      activeGatheringRef.current?.participants.find(
        (candidate) => candidate.id === sessionParticipantId,
      );

    const socket = io(SOCKET_URL, {
      auth: { accessToken },
      transports: ["websocket", "polling"],
      autoConnect: false,
    });
    socketRef.current = socket;
    const refreshSocial = () => {
      void refreshGathering();
    };
    const refreshMatches = () => {
      void gatheringService
        .getMatches(activeGatheringId, sessionResponseToken)
        .then(setMatches)
        .catch(() => {});
    };
    const join = () => {
      socket.emit(
        "gathering:join",
        {
          gatheringId: activeGatheringId,
          participantId: sessionParticipantId,
          participantToken: sessionResponseToken,
        },
        (result: { joined: boolean }) => {
          if (!result?.joined) {
            setIsLiveConnected(false);
            return;
          }
          setIsLiveConnected(true);
          refreshSocial();
          refreshMatches();
          setPurchaseRevision((current) => current + 1);
          void queryClient.invalidateQueries({
            queryKey: checklistKey(activeGatheringId, sessionResponseToken),
            exact: true,
          });
          void refreshExpenses().catch(() => {});
        },
      );
    };
    const refreshExpenses = async (payload?: { participantName?: string }) => {
      const participant = currentParticipant();
      // La liquidación ya no es pública: sin credencial no hay nada que
      // refrescar.
      if (!sessionResponseToken) return;
      const [settlement, details] = await Promise.all([
        gatheringService.getExpenseSettlement(
          activeGatheringId,
          sessionResponseToken,
        ),
        participant
          ? gatheringService.getPaymentDetails(
              activeGatheringId,
              participant.id,
              sessionResponseToken,
            )
          : Promise.resolve(null),
      ]);
      setExpenseSettlement(settlement);
      if (details) setPaymentDetails(details);
      if (
        payload?.participantName &&
        payload.participantName !== participant?.name
      ) {
        setNotice(`${payload.participantName} actualizó las cuentas.`);
        window.setTimeout(() => setNotice(""), 2800);
      }
    };

    socket.on("connect", () => {
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
    socket.on("expenses:changed", () => {
      void refreshExpenses().catch(() => {});
    });
    socket.on("transfers:changed", () => {
      void refreshExpenses().catch(() => {});
    });
    socket.on("checklist:changed", () => {
      void queryClient.invalidateQueries({
        queryKey: checklistKey(activeGatheringId, sessionResponseToken),
        exact: true,
      });
    });
    socket.on("rsvp:changed", refreshSocial);
    socket.on("participants:changed", () => {
      refreshSocial();
      refreshMatches();
      void refreshExpenses().catch(() => {});
      setPurchaseRevision((current) => current + 1);
      void queryClient.invalidateQueries({ queryKey: checklistKey(activeGatheringId, sessionResponseToken), exact: true });
    });
    socket.on("availability:changed", () => {
      refreshSocial();
      refreshMatches();
    });
    socket.on("dietary:changed", refreshSocial);
    socket.on("gathering:changed", (payload?: { action?: string }) => {
      refreshSocial();
      refreshMatches();
      setPurchaseRevision((current) => current + 1);
      if (payload?.action === "confirmed")
        showNotice("El organizador confirmó la fecha.");
      else if (payload?.action === "services") {
        void refreshExpenses().catch(() => {});
        showNotice("El organizador actualizó los servicios de la juntada.");
      } else if (payload?.action === "cancelled")
        showNotice("La juntada fue cancelada.");
      else showNotice("El organizador actualizó la juntada.");
    });
    socket.on(
      "purchase:changed",
      (activity?: {
        action:
          "claim" | "release" | "ready" | "pending" | "contribute" | "remove";
        itemLabel: string;
        participantId: string;
        participantName: string;
      }) => {
        setPurchaseRevision((current) => current + 1);
        const participant = currentParticipant();
        if (!activity || activity.participantId === participant?.id) return;
        const messages = {
          claim: `${activity.participantName} se hace cargo de ${activity.itemLabel}.`,
          release: `${activity.participantName} liberó ${activity.itemLabel}.`,
          ready: `${activity.participantName} ya tiene ${activity.itemLabel}.`,
          pending: `${activity.participantName} volvió a dejar ${activity.itemLabel} pendiente.`,
          contribute: `${activity.participantName} actualizó su aporte de ${activity.itemLabel}.`,
          remove: `${activity.participantName} quitó su aporte de ${activity.itemLabel}.`,
        };
        setNotice(messages[activity.action]);
        window.setTimeout(() => setNotice(""), 2800);
      },
    );

    const goOffline = () => {
      setIsLiveConnected(false);
      socket.disconnect();
    };
    const goOnline = () => {
      socket.connect();
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    if (navigator.onLine) socket.connect();

    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      socket.disconnect();
      socketRef.current = null;
      setLiveMembers([]);
      setTypingMembers([]);
      setAnalyzingMembers([]);
      setIsLiveConnected(false);
    };
  }, [
    accessToken,
    activeGatheringId,
    sessionParticipantId,
    sessionResponseToken,
    isParticipant,
    showNotice,
    refreshGathering,
    queryClient,
  ]);

  /**
   * Guarda la disponibilidad con debounce.
   *
   * Cada toque manda la lista completa y el backend borra y reinserta dentro
   * de una transacción. Antes se disparaba una request por toque: en mobile,
   * eligiendo varios horarios seguidos, las respuestas llegaban desordenadas
   * y la última en escribir se comía las selecciones intermedias.
   */
  const persistAvailability = (nextSlots: string[]) => {
    if (!activeGathering || !participantSession) return;
    const gathering = activeGathering;
    const session = participantSession;

    if (saveAvailabilityTimeoutRef.current) {
      clearTimeout(saveAvailabilityTimeoutRef.current);
    }
    setIsSavingAvailability(true);
    saveAvailabilityTimeoutRef.current = setTimeout(async () => {
      const payload = slots
        .filter((slot) => nextSlots.includes(slot.id))
        .map((slot) => ({
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          kind: "AVAILABLE" as const,
        }));

      setApiError("");
      try {
        await gatheringService.setAvailability(
          gathering.id,
          session.participantId,
          session.responseToken,
          payload,
        );
        setMatches(
          await gatheringService.getMatches(
            gathering.id,
            session.responseToken,
          ),
        );
        setActiveGathering((current) => {
          if (!current) return current;
          return {
            ...current,
            participants: current.participants.map((participant) =>
              participant.id === session.participantId
                ? {
                    ...participant,
                    availabilities: payload.map((slot) => ({
                      id: slot.startsAt,
                      ...slot,
                    })),
                  }
                : participant,
            ),
          };
        });
        savedSlotsRef.current = nextSlots;
      } catch (error) {
        // Se vuelve a lo último que el servidor confirmó, no a un estado
        // intermedio de la ráfaga de toques.
        setYourSlots(savedSlotsRef.current);
        setApiError(
          error instanceof Error
            ? error.message
            : "No pudimos guardar tu disponibilidad.",
        );
      } finally {
        setIsSavingAvailability(false);
      }
    }, 600);
  };

  const toggleSlot = (slotId: string) => {
    if (activeGathering?.status === "CONFIRMED") {
      showNotice("La fecha ya está confirmada. El organizador puede editarla.");
      return;
    }
    if (activeGathering?.status === "CANCELLED") {
      showNotice("Esta juntada fue cancelada.");
      return;
    }
    if (!participantSession) {
      setShowJoin(true);
      return;
    }

    const nextSlots = yourSlots.includes(slotId)
      ? yourSlots.filter((id) => id !== slotId)
      : [...yourSlots, slotId];
    setYourSlots(nextSlots);
    persistAvailability(nextSlots);
  };

  const shareEvent = async () => {
    const text =
      activeGathering?.status === "CONFIRMED"
        ? `¿Sale juntada? Decí si venís a “${eventName}”.`
        : `¿Sale juntada? Marcá cuándo podés para “${eventName}”.`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: eventName,
          text,
          url: window.location.href,
        });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${window.location.href}`);
      setNotice("Link copiado. Mandalo al grupo y listo.");
    } catch {
      setNotice("El link está listo para compartir.");
    }
    window.setTimeout(() => setNotice(""), 2800);
  };

  const joinGathering = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeGathering) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("participantName") || "").trim();
    let contact: string | undefined;
    try {
      contact = normalizeContactPhone(
        String(form.get("participantPhone") || ""),
        String(form.get("participantPhoneCountry") || "AR"),
      );
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Revisá el número de teléfono.");
      return;
    }
    // Si ya hubo un choque de nombre y la persona confirmó que no es ella,
    // insistimos con el mismo nombre en vez de volver a frenarla.
    const allowDuplicateName = duplicateNameWarning === name;

    setIsSubmitting(true);
    setApiError("");
    try {
      if (!accessToken) throw new Error("Ingresá a tu cuenta para aceptar la invitación.");
      const participant = await gatheringService.addAuthenticatedParticipant(
        activeGathering.id,
        accessToken,
        { name, contact: contact || undefined },
      );
      if (!participant.responseToken) {
        throw new Error("No pudimos crear tu acceso a la juntada.");
      }
      const session = {
        participantId: participant.id,
        responseToken: participant.responseToken,
      };
      storeParticipantSession(
        activeGathering.slug,
        session.participantId,
        session.responseToken,
      );
      setParticipantSession(session);
      setAuthorizedSession(session);
      setAvailabilitySelection([]);
      setShowJoin(false);
      if (!view && activeGathering.status === "OPEN")
        navigate(`${basePath}/fecha`);
      setDuplicateNameWarning("");
      setNotice(
        `¡Listo, ${participant.name}! ${activeGathering.status === "CONFIRMED" ? "Decí si venís." : "Marcá cuándo podés."}`,
      );
      window.setTimeout(() => setNotice(""), 2800);
    } catch (error) {
      // El backend frena los nombres repetidos porque un duplicado cambia la
      // división de gastos de todo el grupo. Le damos salida a las dos
      // opciones: recuperar el acceso, o entrar igual siendo otra persona.
      if (
        error instanceof ApiError &&
        error.status === 400 &&
        !allowDuplicateName &&
        !accessToken
      ) {
        setDuplicateNameWarning(name);
      }
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

    // Una clave por intento lógico, reusada mientras el formulario no se
    // limpie: si el primer envío se pierde en la red y la persona vuelve a
    // tocar, el backend reconoce el reintento en vez de duplicar el gasto.
    expenseIdempotencyKeyRef.current ??= crypto.randomUUID();

    setIsSavingExpense(true);
    setApiError("");
    try {
      await gatheringService.addExpense(
        activeGathering.id,
        participantSession.participantId,
        participantSession.responseToken,
        expenseIdempotencyKeyRef.current,
        {
          description,
          amountCents: Math.round(amount * 100),
        },
      );
      // Recién cuando el gasto quedó guardado se descarta la clave: el
      // próximo gasto es un intento nuevo y necesita una propia.
      expenseIdempotencyKeyRef.current = null;
      setExpenseSettlement(
        await gatheringService.getExpenseSettlement(
          activeGathering.id,
          participantSession.responseToken,
        ),
      );
      form.reset();
      setExpenseAmount("");
      setExpenseDescription("");
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
        await gatheringService.getExpenseSettlement(
          activeGathering.id,
          participantSession.responseToken,
        ),
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

  const savePaymentAlias = async (paymentAlias: string) => {
    if (!activeGathering || !participantSession) return;
    setIsSavingPaymentAlias(true);
    setApiError("");
    try {
      await gatheringService.updatePaymentAlias(
        activeGathering.id,
        participantSession.participantId,
        participantSession.responseToken,
        paymentAlias,
        accessToken,
      );
      setPaymentDetails(
        await gatheringService.getPaymentDetails(
          activeGathering.id,
          participantSession.participantId,
          participantSession.responseToken,
        ),
      );
      showNotice(paymentAlias ? "Alias guardado." : "Alias eliminado.");
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : "No pudimos guardar tu alias.",
      );
    } finally {
      setIsSavingPaymentAlias(false);
    }
  };

  const copyPaymentAlias = async (paymentAlias: string) => {
    try {
      await navigator.clipboard.writeText(paymentAlias);
      showNotice("Alias copiado. Verificá el titular antes de transferir.");
    } catch {
      setApiError(
        "No pudimos copiar el alias. Mantenelo presionado para copiarlo.",
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
        await gatheringService.getExpenseSettlement(
          activeGathering.id,
          participantSession.responseToken,
        ),
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

  const confirmProposal = async (slotId: string) => {
    if (!activeGathering || !participantSession) return;
    const slot = slots.find((candidate) => candidate.id === slotId);
    const organizer = activeGathering.participants.find(
      (participant) => participant.id === participantSession.participantId,
    );
    if (!slot || !organizer?.isOrganizer) return;

    setIsConfirmingGathering(true);
    setApiError("");
    try {
      const updated = await gatheringService.finalizeGathering(
        activeGathering.id,
        participantSession.participantId,
        participantSession.responseToken,
        {
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          location: activeGathering.locationHint ?? location,
        },
      );
      setActiveGathering(updated);
      setShowResults(false);
      showNotice("Fecha confirmada y guardada para todo el grupo.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : "No pudimos confirmar la fecha.",
      );
    } finally {
      setIsConfirmingGathering(false);
    }
  };

  const saveGatheringSettings = async (input: UpdateGatheringInput) => {
    if (!activeGathering || !participantSession) return;
    setIsManagingGathering(true);
    setApiError("");
    try {
      const updated = await gatheringService.updateGathering(
        activeGathering.id,
        participantSession.participantId,
        participantSession.responseToken,
        input,
      );
      setActiveGathering(updated);
      setAvailabilitySelection(
        updated.participants
          .find(
            (participant) =>
              participant.id === participantSession.participantId,
          )
          ?.availabilities?.map((availability) => availability.startsAt) ?? [],
      );
      setMatches(
        await gatheringService.getMatches(
          updated.id,
          participantSession.responseToken,
        ),
      );
      setShowManageGathering(false);
      showNotice("Juntada actualizada para todo el grupo.");
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : "No pudimos actualizar la juntada.",
      );
    } finally {
      setIsManagingGathering(false);
    }
  };

  const cancelActiveGathering = async () => {
    if (!activeGathering || !participantSession) return;
    setIsManagingGathering(true);
    setApiError("");
    try {
      const updated = await gatheringService.cancelGathering(
        activeGathering.id,
        participantSession.participantId,
        participantSession.responseToken,
      );
      setActiveGathering(updated);
      setShowManageGathering(false);
      showNotice("La juntada quedó cancelada.");
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : "No pudimos cancelar la juntada.",
      );
    } finally {
      setIsManagingGathering(false);
    }
  };

  const openExpenseEditor = (expense: Expense) => {
    setEditingExpense(expense);
    setExpenseEditDescription(expense.description);
    setExpenseEditAmount(
      Math.round(expense.amountCents / 100).toLocaleString("es-AR"),
    );
  };

  const updateActiveExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeGathering || !participantSession || !editingExpense) return;
    const amount = Number(expenseEditAmount.replace(/\./g, ""));
    if (
      expenseEditDescription.trim().length < 2 ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return;
    }
    setIsUpdatingExpense(true);
    setApiError("");
    try {
      await gatheringService.updateExpense(
        activeGathering.id,
        participantSession.participantId,
        participantSession.responseToken,
        editingExpense.id,
        {
          description: expenseEditDescription.trim(),
          amountCents: Math.round(amount * 100),
        },
      );
      setExpenseSettlement(
        await gatheringService.getExpenseSettlement(
          activeGathering.id,
          participantSession.responseToken,
        ),
      );
      setEditingExpense(null);
      showNotice("Gasto corregido y cuentas recalculadas.");
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : "No pudimos corregir el gasto.",
      );
    } finally {
      setIsUpdatingExpense(false);
    }
  };

  const deleteActiveExpense = async (expense: Expense) => {
    if (!activeGathering || !participantSession) return;
    if (!window.confirm(`¿Eliminar el gasto “${expense.description}”?`)) return;
    setIsUpdatingExpense(true);
    setApiError("");
    try {
      await gatheringService.deleteExpense(
        activeGathering.id,
        participantSession.participantId,
        participantSession.responseToken,
        expense.id,
      );
      setExpenseSettlement(
        await gatheringService.getExpenseSettlement(
          activeGathering.id,
          participantSession.responseToken,
        ),
      );
      showNotice("Gasto eliminado y cuentas recalculadas.");
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : "No pudimos eliminar el gasto.",
      );
    } finally {
      setIsUpdatingExpense(false);
    }
  };

  const currentParticipant = authorizedSession && activeGathering?.participants.find(
    (participant) => participant.id === participantSession?.participantId,
  );
  const profileEditor = currentParticipant && participantSession && activeGathering ? (
    <ParticipantProfileEditor
      key={`${currentParticipant.id}:${currentParticipant.avatarUrl}`}
      gatheringId={activeGathering.id}
      participant={currentParticipant}
      token={participantSession.responseToken}
      googlePhoto={authAvatarUrl}
      onSaved={(avatarUrl) => {
        showNotice("Tu avatar quedó guardado.");
        setActiveGathering(current => current ? { ...current, participants: current.participants.map(person => person.id === currentParticipant.id ? { ...person, avatarUrl } : person) } : current);
      }}
    />
  ) : null;

  const currentParticipantExpensesReady =
    expenseSettlement?.readyParticipants.some(
      (participant) => participant.participantId === currentParticipant?.id,
    ) ?? false;
  const recipientAliases = useMemo(
    () =>
      new Map(
        paymentDetails?.recipients.map((recipient) => [
          recipient.participantId,
          recipient.paymentAlias,
        ]) ?? [],
      ),
    [paymentDetails?.recipients],
  );
  const respondingParticipants =
    activeGathering?.participants.filter(
      (participant) => (participant.availabilities?.length ?? 0) > 0,
    ).length ?? 0;
  /**
   * Cuánta gente hay en la juntada.
   *
   * Sin sesión el backend no manda la lista de participantes —no revela
   * identidades a quien sólo tiene el link— pero sí el total, que es lo que
   * hace falta para mostrar "5 personas" en la pantalla de invitación.
   */
  const participantTotal =
    activeGathering?.participantCount ??
    activeGathering?.participants.length ??
    0;
  const bestMatch = matches[0];
  const resultAnalysis = useMemo(() => {
    if (!activeGathering || !bestMatch) return null;
    const bestPendingNames = bestMatch.pendingParticipantNames ?? [];
    const bestConflictNames = bestMatch.conflictParticipantNames ?? [];

    if (bestMatch.available === bestMatch.total) {
      return {
        title: "Hay un horario donde pueden todos",
        detail:
          "No hace falta negociar cambios: ya tienen una coincidencia completa.",
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
      action:
        "Conviene completar las respuestas pendientes y después negociar con quienes sigan afuera.",
    };
  }, [activeGathering, bestMatch]);
  const findBestMoment = async () => {
    if (!activeGathering) return;
    if (!participantSession) {
      setShowJoin(true);
      return;
    }

    setApiError("");
    socketRef.current?.emit("analysis:started", {
      gatheringId: activeGathering.id,
    });
    try {
      setMatches(
        await gatheringService.getMatches(
          activeGathering.id,
          participantSession.responseToken,
        ),
      );
      setShowResults(true);
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : "No pudimos calcular los horarios.",
      );
    }
  };

  // Ruta real: sin juntada significa loading, error o not-found. Nunca demo.
  if (notFound) {
    return <NotFoundGathering />;
  }

  if (!activeGathering) {
    if (gatheringQuery.error) {
      return (
        <main className="app-root not-found-page">
          <header className="topbar">
            <a className="brand" href="/" aria-label="Sale Juntada, inicio">
              <span className="brand-mark">
                <SparkIcon />
              </span>
              <span>Sale Juntada</span>
            </a>
          </header>
          <section className="status-page">
            <span className="eyebrow">
              <SparkIcon /> Ups
            </span>
            <h1>No pudimos abrir esta juntada.</h1>
            <p>{gatheringQuery.error.message}</p>
            <button
              className="primary-button"
              type="button"
              onClick={() => void gatheringQuery.refetch()}
            >
              Reintentar <span aria-hidden="true">↻</span>
            </button>
          </section>
        </main>
      );
    }
    return <GatheringSkeleton />;
  }

  const overviewProps = currentParticipant
    ? {
        gathering: activeGathering,
        participant: currentParticipant,
        checklist: checklistQuery.data,
        checklistError: Boolean(checklistQuery.error),
        settlement: expenseSettlement,
      }
    : null;
  const moduleTitle = gatheringModuleTitle(view);
  const serviceArchived = !isGatheringServiceEnabled(activeGathering, view);
  const moduleReadOnly =
    activeGathering.status === "CANCELLED" || serviceArchived;

  return (
    <main
      className={`app-root gathering-app ${currentParticipant ? "is-member" : ""}`}
    >
      <header className="topbar">
        <Link className="brand" to={basePath} aria-label="Sale Juntada, inicio">
          <span className="brand-mark">
            <SparkIcon />
          </span>
          <span>Sale Juntada</span>
        </Link>
        <div className="header-actions">
          {currentParticipant ? (
            <m.span
              className={`connection-status ${isLiveConnected ? "connected" : "reconnecting"}`}
              role="status"
              key={isLiveConnected ? "connected" : "reconnecting"}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={springTransition}
            >
              <i aria-hidden="true" />
              {isLiveConnected ? "En vivo" : "Reconectando"}
            </m.span>
          ) : null}
          {currentParticipant?.isOrganizer &&
          activeGathering.status !== "CANCELLED" ? (
            <button
              className="manage-button"
              type="button"
              onClick={() => setShowManageGathering(true)}
            >
              Administrar
            </button>
          ) : null}
          <button
            className={`avatar-button ${user ? "authenticated" : ""}`}
            aria-label={
              user ? `Cuenta de ${authName}` : "Ingresar o crear una cuenta"
            }
            type="button"
            onClick={() => setShowAccount(true)}
          >
            {currentParticipant ? (
              <ParticipantAvatar name={currentParticipant.name} avatarUrl={currentParticipant.avatarUrl} />
            ) : authAvatarUrl ? (
              <img src={authAvatarUrl} alt="" />
            ) : user ? (
              initials(authName)
            ) : activeGathering && participantSession ? (
              (() => {
                const participant = activeGathering.participants.find(
                  (candidate) =>
                    candidate.id === participantSession.participantId,
                );
                return participant?.avatarUrl?.startsWith("emoji:")
                  ? participant.avatarUrl.slice(6)
                  : initials(participant?.name ?? "TF");
              })()
            ) : isLoadingAuth ? (
              "…"
            ) : (
              "↗"
            )}
          </button>
        </div>
      </header>

      <div className={currentParticipant ? "gathering-shell" : ""}>
        {currentParticipant ? (
          <GatheringNavigation gathering={activeGathering} />
        ) : null}
        <div className="gathering-content">
          {!currentParticipant || !view ? (
            <GatheringHero gathering={activeGathering} onShare={shareEvent} />
          ) : (
            <header className="module-heading">
              <div>
                <Link className="module-back" to={basePath}>
                  ← {activeGathering.title}
                </Link>
                <h1 ref={moduleHeadingRef} tabIndex={-1}>
                  {moduleTitle ?? "Servicio no encontrado"}
                </h1>
              </div>
              {view !== "servicios" ? (
                <Link className="module-switch" to={`${basePath}/servicios`}>
                  Ver servicios
                </Link>
              ) : null}
            </header>
          )}
          {currentParticipant && view && !moduleTitle ? (
            <p>
              Este servicio no existe.{" "}
              <Link to={basePath}>Volver a la juntada</Link>
            </p>
          ) : null}
          {!currentParticipant && activeGathering.status !== "CANCELLED" ? (
            <JoinGathering
              open={showJoin}
              defaultName={user ? authName : undefined}
              isSubmitting={isSubmitting}
              warning={duplicateNameWarning}
              error={apiError}
              hasDate={activeGathering.status === "CONFIRMED"}
              onOpen={() => setShowJoin(true)}
              onSubmit={joinGathering}
              onAccount={() => setShowAccount(true)}
            />
          ) : null}
          {currentParticipant && serviceArchived ? (
            <div className="service-archived-banner" role="status">
              <strong>Este servicio está desactivado</strong>
              <p>
                Podés consultar el historial.{" "}
                {currentParticipant.isOrganizer
                  ? "Reactivalo desde Servicios para volver a usarlo."
                  : "Quien organiza puede reactivarlo desde Servicios."}
              </p>
              <Link to={`${basePath}/servicios`}>Ir a Servicios →</Link>
            </div>
          ) : null}
          <fieldset
            className="gathering-module-content"
            disabled={moduleReadOnly}
          >
            {currentParticipant &&
            (view === "invitados" ||
              (!view && !currentParticipant.rsvpStatus)) &&
            activeGathering.status === "CONFIRMED" &&
            activeGathering.finalizedStart ? (
              <RsvpSelector
                participant={currentParticipant}
                pending={rsvp.isPending}
                error={rsvp.error?.message}
                onChange={(status, plusOnes) =>
                  rsvp.mutate({ status, plusOnes })
                }
              />
            ) : null}
            {currentParticipant &&
            !view &&
            currentParticipant.rsvpStatus &&
            activeGathering.status === "CONFIRMED" ? (
              <Link
                className="gathering-attendance-link"
                to={`${basePath}/invitados`}
              >
                <span>
                  Tu respuesta:{" "}
                  <strong>
                    {currentParticipant.rsvpStatus === "GOING"
                      ? "Voy"
                      : currentParticipant.rsvpStatus === "MAYBE"
                        ? "No sé"
                        : "No voy"}
                  </strong>
                  {currentParticipant.plusOnes
                    ? ` · +${currentParticipant.plusOnes}`
                    : ""}
                </span>
                <span>Ver invitados →</span>
              </Link>
            ) : null}
            {currentParticipant && view === "invitados" ? (
              <AttendanceSummary
                gathering={activeGathering}
                viewerId={currentParticipant.id}
              />
            ) : null}

            {view === "pendientes" &&
            currentParticipant &&
            participantSession &&
            activeGathering.isParticipant ? (
              <GatheringChecklist
                gathering={activeGathering}
                participant={currentParticipant}
                token={participantSession.responseToken}
                readOnly={moduleReadOnly}
              />
            ) : null}

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

            {activeGathering?.status === "CANCELLED" ? (
              <div className="status-banner cancelled" role="status">
                Esta juntada fue cancelada. La información queda visible, pero
                ya no acepta cambios.
              </div>
            ) : null}

            {overviewProps && !view ? (
              <GatheringHome {...overviewProps} />
            ) : null}
            {overviewProps && participantSession && view === "servicios" ? (
              currentParticipant?.isOrganizer ? (
                <GatheringServiceSettings
                  {...overviewProps}
                  token={participantSession.responseToken}
                />
              ) : (
                <GatheringServices {...overviewProps} />
              )
            ) : null}
            {overviewProps && view === "mi-parte" ? (
              <div>{profileEditor}<GatheringPersonalTasks {...overviewProps} /></div>
            ) : null}

            {currentParticipant && view === "fecha" ? (
              <section className="workspace" id="disponibilidad">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">JUNTADA ACTIVA</span>
                    <h2>{eventName}</h2>
                  </div>
                </div>

                <GatheringDatePlace gathering={activeGathering} />

                {activeGathering?.status === "OPEN" && (
                  <>
                    <div className="planning-grid">
                      <div className="availability-card">
                        <div className="card-title-row">
                          <div>
                            <h3>¿Cuándo podés?</h3>
                            <p>Cada opción muestra inicio y fin. Podés elegir más de una.</p>
                          </div>
                          <AnimatePresence mode="wait" initial={false}>
                            <m.span
                              className="selection-count"
                              key={yourSlots.length}
                              initial={{ opacity: 0, y: -5, scale: 0.94 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 5, scale: 0.94 }}
                              transition={quickTransition}
                            >
                              {yourSlots.length} elegidos
                            </m.span>
                          </AnimatePresence>
                        </div>

                        <div className="slot-carousel-toolbar">
                          <span>Deslizá para ver todos los días</span>
                          <div>
                            <button
                              type="button"
                              aria-label="Ver día anterior"
                              aria-controls="availability-days"
                              onClick={() => scrollAvailabilityDays(-1)}
                            >
                              ←
                            </button>
                            <button
                              type="button"
                              aria-label="Ver día siguiente"
                              aria-controls="availability-days"
                              onClick={() => scrollAvailabilityDays(1)}
                            >
                              →
                            </button>
                          </div>
                        </div>

                        <div
                          id="availability-days"
                          className="slot-grid"
                          ref={availabilityGridRef}
                          role="group"
                          aria-label="Elegí tus horarios disponibles"
                          tabIndex={0}
                        >
                          {slotGroups.map((group) => (
                            <section
                              className="day-slot-group"
                              key={`${group.day}-${group.date}`}
                            >
                              <div className="day-slot-heading">
                                <span>{group.day}</span>
                                <strong>{group.date.split(" ")[0]}</strong>
                                <small>{group.date.split(" ")[1]}</small>
                              </div>
                              <div className="time-options">
                                {group.slots.map((slot) => {
                                  const selected = yourSlots.includes(slot.id);
                                  return (
                                    <m.button
                                      key={slot.id}
                                      className={`time-option ${selected ? "selected" : ""}`}
                                      aria-label={`${slot.day} ${slot.date} · ${slot.range ?? slot.time}`}
                                      aria-pressed={selected}
                                      disabled={
                                        activeGathering?.status ===
                                          "CONFIRMED" ||
                                        activeGathering?.status === "CANCELLED"
                                      }
                                      onClick={() => toggleSlot(slot.id)}
                                      whileTap={{ scale: 0.965 }}
                                      layout
                                    >
                                      <span>{slot.range ?? slot.time}</span>
                                      <m.i
                                        key={
                                          selected ? "selected" : "available"
                                        }
                                        initial={{
                                          scale: 0.7,
                                          rotate: selected ? -24 : 0,
                                        }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        transition={springTransition}
                                      >
                                        {selected ? "✓" : "+"}
                                      </m.i>
                                    </m.button>
                                  );
                                })}
                              </div>
                            </section>
                          ))}
                        </div>

                        <div className="your-status">
                          <span className="person-avatar coral">
                            {currentParticipant
                              ? initials(currentParticipant.name)
                              : "VO"}
                          </span>
                          <div>
                            <strong>
                              {currentParticipant?.name ?? "Tu disponibilidad"}
                            </strong>
                            <small>Se guarda automáticamente</small>
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
                            <p>{participantTotal} personas</p>
                          </div>
                          <span className="response-pill">
                            {respondingParticipants}/{participantTotal}{" "}
                            respondieron
                          </span>
                        </div>
                        <m.div
                          className="friend-list"
                          variants={listVariants}
                          initial="hidden"
                          animate="visible"
                        >
                          <AnimatePresence initial={false}>
                            {activeGathering?.participants.map(
                              (participant, index) => {
                                const availableCount =
                                  participant.availabilities?.filter(
                                    (availability) =>
                                      availability.kind === "AVAILABLE",
                                  ).length ?? 0;
                                const availabilitySummary =
                                  formatAvailabilitySummary(
                                    participant.availabilities,
                                  );
                                const colors = [
                                  "peach",
                                  "blue",
                                  "purple",
                                  "green",
                                  "yellow",
                                  "coral",
                                ];
                                return (
                                  <m.div
                                    className="friend-row"
                                    key={participant.id}
                                    layout
                                    variants={listItemVariants}
                                    exit="exit"
                                  >
                                    <ParticipantAvatar
                                      name={participant.name}
                                      avatarUrl={participant.avatarUrl}
                                      color={colors[index % colors.length]}
                                    />
                                    <div>
                                      <strong>
                                        {participant.name}
                                        {participant.id ===
                                        participantSession?.participantId
                                          ? " (vos)"
                                          : ""}
                                      </strong>
                                      <small
                                        className="friend-availability-detail"
                                        title={availabilitySummary}
                                      >
                                        {availabilitySummary}
                                      </small>
                                    </div>
                                    <span
                                      className={
                                        availableCount > 0 ? "check" : "pending"
                                      }
                                    >
                                      {availableCount > 0 ? "✓" : "·"}
                                    </span>
                                  </m.div>
                                );
                              },
                            )}
                          </AnimatePresence>
                        </m.div>
                      </aside>
                    </div>

                    <m.button
                      className="find-button"
                      onClick={findBestMoment}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.975 }}
                      transition={quickTransition}
                    >
                      <SparkIcon /> Encontrar el mejor momento
                    </m.button>
                    <p className="find-caption">
                      Analizamos todas las disponibilidades y te damos las
                      mejores opciones.
                    </p>
                  </>
                )}
              </section>
            ) : null}

            {view === "compra" && currentParticipant && (
              <PurchasePlanner
                key={activeGathering.id}
                gatheringKey={activeGathering.id}
                gatheringId={activeGathering.id}
                participantId={participantSession?.participantId}
                participantToken={participantSession?.responseToken}
                canEdit={Boolean(currentParticipant?.isOrganizer)}
                readOnly={moduleReadOnly}
                remoteRevision={purchaseRevision}
                isLiveConnected={isLiveConnected}
                participantCount={participantTotal}
                onRequireParticipant={() => setShowJoin(true)}
                onNotice={showNotice}
              />
            )}

            {view === "compra" && currentParticipant ? (
              <Link
                className="module-related-link"
                to={`${basePath}/alimentacion`}
              >
                Ver necesidades alimentarias del grupo →
              </Link>
            ) : null}
            {view === "alimentacion" &&
            currentParticipant &&
            participantSession ? (
              <DietaryPlanner
                gatheringId={activeGathering.id}
                participantId={currentParticipant.id}
                participantToken={participantSession.responseToken}
                participants={activeGathering.participants}
                currentParticipant={currentParticipant}
                readOnly={moduleReadOnly}
                onDietaryUpdated={(updatedParticipant) => {
                  setActiveGathering((current) =>
                    current
                      ? {
                          ...current,
                          participants: current.participants.map(
                            (participant) =>
                              participant.id === updatedParticipant.id
                                ? { ...participant, ...updatedParticipant }
                                : participant,
                          ),
                        }
                      : current,
                  );
                }}
                onNotice={showNotice}
              />
            ) : null}
            {view === "alimentacion" && currentParticipant ? (
              <Link className="module-related-link" to={`${basePath}/compra`}>
                Ir a compra y aportes →
              </Link>
            ) : null}

            {currentParticipant && isAccounts && !expenseSettlement ? (
              <div
                className="module-load-state"
                role={expensesLoadError ? "alert" : "status"}
              >
                <p>
                  {expensesLoadError
                    ? "No pudimos cargar las cuentas."
                    : "Cargando cuentas…"}
                </p>
                {expensesLoadError ? (
                  <button
                    className="primary-button"
                    onClick={() => {
                      setExpensesLoadError(false);
                      void gatheringService
                        .getExpenseSettlement(
                          activeGathering.id,
                          participantSession!.responseToken,
                        )
                        .then(setExpenseSettlement)
                        .catch(() => setExpensesLoadError(true));
                    }}
                  >
                    Reintentar
                  </button>
                ) : null}
              </div>
            ) : null}
            {currentParticipant && isAccounts && expenseSettlement && (
              <section className="expenses-section" id="gastos">
                <fieldset
                  className="accounts-content"
                  disabled={moduleReadOnly}
                >
                  <nav className="accounts-tabs" aria-label="Vistas de cuentas">
                    <NavLink end to={`${basePath}/cuentas`}>
                      Gastos
                    </NavLink>
                    <NavLink to={`${basePath}/cuentas/transferencias`}>
                      Transferencias
                    </NavLink>
                  </nav>
                  <div className="expenses-heading">
                    <div>
                      <span className="section-kicker">
                        LAS CUENTAS CLARAS MANTIENEN LA AMISTAD
                      </span>
                      <h2>Dividir gastos sin calculadora.</h2>
                      <p>
                        Cada uno carga lo que pagó. Dividimos el total entre las{" "}
                        {activeGathering.participants.length} personas y
                        evitamos transferencias innecesarias.
                      </p>
                    </div>
                    <div className="expense-total">
                      <span>Total gastado</span>
                      <strong>
                        {formatMoney(expenseSettlement?.totalCents ?? 0)}
                      </strong>
                      <small>
                        {formatMoney(expenseSettlement?.averageCents ?? 0)} por
                        persona
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
                      <span>
                        {listNames(liveMembers.map((member) => member.name))}
                      </span>
                    )}
                    <AnimatePresence initial={false}>
                      {typingMembers.map((member) => (
                        <m.em
                          key={`typing-${member.participantId}`}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                        >
                          {member.name} está cargando un gasto…
                        </m.em>
                      ))}
                      {analyzingMembers.map((member) => (
                        <m.em
                          key={`analysis-${member.participantId}`}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                        >
                          {member.name} está analizando horarios…
                        </m.em>
                      ))}
                    </AnimatePresence>
                  </div>

                  {(expenseSettlement?.expenses.length ?? 0) > 0 && (
                    <div
                      className={`expense-closing ${expenseSettlement?.allReady ? "ready" : ""}`}
                    >
                      <div className="closing-progress">
                        <span>
                          RONDA {expenseSettlement?.expenseRound ?? 1}
                          {(expenseSettlement?.expenseRound ?? 1) > 1
                            ? " · AJUSTE"
                            : ""}
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
                        <span className="ready-confirmation">
                          👀 Modo espectador
                        </span>
                      ) : currentParticipantExpensesReady ? (
                        <span className="ready-confirmation">
                          ✓ Ya confirmaste
                        </span>
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

                  {currentParticipant ? (
                    <PaymentAliasEditor
                      key={paymentDetails?.paymentAlias ?? "without-alias"}
                      paymentAlias={paymentDetails?.paymentAlias ?? null}
                      persistsToProfile={Boolean(user)}
                      isSaving={isSavingPaymentAlias}
                      onSave={savePaymentAlias}
                    />
                  ) : null}

                  <div className="expenses-grid">
                    {view === "cuentas" ? (
                      <>
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
                                value={expenseDescription}
                                onChange={(event) => {
                                  setExpenseDescription(event.target.value);
                                  signalExpenseTyping();
                                }}
                                disabled={
                                  activeGathering.status === "CANCELLED"
                                }
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
                                    setExpenseAmount(
                                      formatThousands(event.target.value),
                                    );
                                    signalExpenseTyping();
                                  }}
                                  disabled={
                                    activeGathering.status === "CANCELLED"
                                  }
                                  placeholder="0"
                                  required
                                />
                              </div>
                            </label>
                            <button
                              className="primary-button full"
                              type="submit"
                              disabled={
                                isSavingExpense ||
                                activeGathering.status === "CANCELLED"
                              }
                            >
                              {activeGathering.status === "CANCELLED"
                                ? "Juntada cancelada"
                                : isSavingExpense
                                  ? "Calculando…"
                                  : "Agregar y recalcular"}
                            </button>
                          </form>

                          <div className="expense-history">
                            <strong>Gastos cargados</strong>
                            {(expenseSettlement?.expenses.length ?? 0) ===
                              0 && (
                              <p className="empty-expenses">
                                Todavía no cargaron gastos.
                              </p>
                            )}
                            <AnimatePresence initial={false}>
                              {expenseSettlement?.expenses.map((expense) => (
                                <m.div
                                  className="expense-row"
                                  key={expense.id}
                                  layout
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: 10 }}
                                  transition={standardTransition}
                                >
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
                                  {currentParticipant &&
                                  activeGathering.status !== "CANCELLED" &&
                                  (expense.paidByParticipantId ===
                                    currentParticipant.id ||
                                    currentParticipant.isOrganizer) ? (
                                    <span className="expense-row-actions">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openExpenseEditor(expense)
                                        }
                                        aria-label={`Editar ${expense.description}`}
                                      >
                                        Editar
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isUpdatingExpense}
                                        onClick={() =>
                                          void deleteActiveExpense(expense)
                                        }
                                        aria-label={`Eliminar ${expense.description}`}
                                      >
                                        Eliminar
                                      </button>
                                    </span>
                                  ) : null}
                                </m.div>
                              ))}
                            </AnimatePresence>
                          </div>
                        </div>
                      </>
                    ) : null}
                    {view === "cuentas/transferencias" ? (
                      <div className="settlement-card">
                        <div className="settlement-title">
                          <div>
                            <span>
                              <SparkIcon /> DIVISIÓN AUTOMÁTICA
                            </span>
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
                            <p>
                              Con el primer gasto calculamos automáticamente
                              quién paga y quién recibe.
                            </p>
                          </div>
                        )}
                        {(expenseSettlement?.expenses.length ?? 0) > 0 &&
                          expenseSettlement?.transfers.length === 0 && (
                            <div className="settlement-empty settled">
                              <span>✓</span>
                              <strong>Ya están a mano</strong>
                              <p>
                                No hace falta realizar ninguna transferencia.
                              </p>
                            </div>
                          )}
                        {(expenseSettlement?.expenses.length ?? 0) > 0 &&
                          !expenseSettlement?.allReady &&
                          (expenseSettlement?.transfers.length ?? 0) > 0 && (
                            <div className="transfer-lock">
                              <span>🔒</span>
                              <div>
                                <strong>División preliminar</strong>
                                <p>
                                  Las transferencias se habilitan cuando todos
                                  confirmen que terminaron de cargar.
                                </p>
                              </div>
                            </div>
                          )}
                        <AnimatePresence initial={false}>
                          {expenseSettlement?.transfers.map((transfer) => (
                            <m.div
                              className={`transfer-row ${transfer.settled ? "settled" : ""}`}
                              key={transfer.id}
                              layout
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -8 }}
                              transition={standardTransition}
                            >
                              <ParticipantAvatar
                                name={transfer.fromName}
                                avatarUrl={
                                  activeGathering.participants.find(
                                    (participant) =>
                                      participant.id ===
                                      transfer.fromParticipantId,
                                  )?.avatarUrl
                                }
                                color="coral"
                              />
                              <div>
                                <strong>{transfer.fromName}</strong>
                                <small>le transfiere a {transfer.toName}</small>
                                {expenseSettlement.allReady &&
                                transfer.fromParticipantId ===
                                  currentParticipant?.id ? (
                                  recipientAliases.get(
                                    transfer.toParticipantId,
                                  ) ? (
                                    <button
                                      className="transfer-alias"
                                      type="button"
                                      onClick={() =>
                                        void copyPaymentAlias(
                                          recipientAliases.get(
                                            transfer.toParticipantId,
                                          )!,
                                        )
                                      }
                                      title="Copiar alias"
                                    >
                                      Alias:{" "}
                                      {recipientAliases.get(
                                        transfer.toParticipantId,
                                      )}
                                      <span aria-hidden="true">⧉</span>
                                    </button>
                                  ) : (
                                    <small className="transfer-alias-missing">
                                      {transfer.toName} todavía no cargó su
                                      alias
                                    </small>
                                  )
                                ) : null}
                              </div>
                              <b>{formatMoney(transfer.amountCents)}</b>
                              <span className="transfer-arrow">→</span>
                              <ParticipantAvatar
                                name={transfer.toName}
                                avatarUrl={
                                  activeGathering.participants.find(
                                    (participant) =>
                                      participant.id ===
                                      transfer.toParticipantId,
                                  )?.avatarUrl
                                }
                                color="green"
                              />
                              <div className="transfer-state">
                                {expenseSettlement.allReady &&
                                transfer.fromParticipantId ===
                                  currentParticipant?.id ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      confirmTransferPayment(transfer)
                                    }
                                  >
                                    Marcar como transferido
                                  </button>
                                ) : (
                                  <span className="pending-transfer">
                                    {expenseSettlement.allReady
                                      ? "Pendiente"
                                      : "A confirmar"}
                                  </span>
                                )}
                              </div>
                            </m.div>
                          ))}
                        </AnimatePresence>
                        {(expenseSettlement?.completedTransfers.length ?? 0) >
                          0 && (
                          <div className="completed-transfers">
                            <strong>Transferencias ya realizadas</strong>
                            {expenseSettlement?.completedTransfers.map(
                              (transfer) => (
                                <div key={transfer.id}>
                                  <span>
                                    ✓ {transfer.fromName} → {transfer.toName}
                                  </span>
                                  <b>{formatMoney(transfer.amountCents)}</b>
                                </div>
                              ),
                            )}
                          </div>
                        )}
                        {(expenseSettlement?.balances.length ?? 0) > 0 && (
                          <div className="balance-note">
                            El reparto contempla centavos para que el total
                            cierre exactamente.
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </fieldset>
              </section>
            )}

            {currentParticipant && view === "juegos" ? (
              <Suspense fallback={<p role="status">Abriendo juegos…</p>}>
                <PartyGames />
              </Suspense>
            ) : null}
          </fieldset>
        </div>
      </div>

      <AnimatedDialog
        open={showResults}
        onClose={() => setShowResults(false)}
        panelClassName="results-sheet"
        label="Resultados de la juntada"
      >
        <button
          className="close-button"
          onClick={() => setShowResults(false)}
          aria-label="Cerrar"
        >
          ×
        </button>
        <span className="eyebrow">
          <SparkIcon /> Análisis listo
        </span>
        <h2 id="results-title">¿Qué falta para que salga?</h2>
        <p>
          Te mostramos la mejor opción, el bloqueo y el cambio más corto para
          resolverlo.
        </p>
        {resultAnalysis && (
          <section
            className="result-analysis"
            aria-label="Diagnóstico del grupo"
          >
            <div className="analysis-icon">
              <SparkIcon />
            </div>
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
        {matches.length > 0 && (
          <div className="alternatives-heading">
            <strong>Horarios para proponer</strong>
            <span>De menor a mayor esfuerzo</span>
          </div>
        )}
        <m.div
          className="proposal-list"
          variants={listVariants}
          initial="hidden"
          animate="visible"
        >
          {matches.length === 0 && (
            <div className="empty-results">
              Todavía no hay disponibilidades cargadas. Compartí el link para
              que el grupo responda.
            </div>
          )}
          {matches.map((match, index) => {
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
              <m.article
                className={`proposal ${index === 0 ? "best" : ""}`}
                key={match.startsAt}
                variants={listItemVariants}
                layout
              >
                <div className="proposal-rank">{index + 1}</div>
                <div className="proposal-date">
                  <strong>{dateLabel}</strong>
                  <span>
                    {timeLabel} · {location}
                  </span>
                </div>
                <div className="proposal-score">
                  <strong>
                    {match.available}/{match.total}
                  </strong>
                  <span>
                    {index === 0 ? "Mejor opción" : match.explanation}
                  </span>
                </div>
                <div className="proposal-breakdown">
                  <span className="can-attend">
                    ✓ Pueden:{" "}
                    {availableNames.length > 0
                      ? listNames(availableNames)
                      : "todavía nadie"}
                  </span>
                  {match.missing === 0 && (
                    <span className="all-attend">
                      Listo: no hay que mover a nadie.
                    </span>
                  )}
                  {pendingNames.length > 0 && (
                    <span className="waiting-on">
                      Esperando respuesta de {listNames(pendingNames)}.
                    </span>
                  )}
                  {conflictNames.length > 0 && (
                    <span className="needs-change">
                      Para llegar a {match.total}/{match.total},{" "}
                      {listNames(conflictNames)}
                      {conflictNames.length === 1
                        ? " tendría"
                        : " tendrían"}{" "}
                      que mover su disponibilidad.
                    </span>
                  )}
                </div>
                {currentParticipant?.isOrganizer &&
                  activeGathering.status !== "CONFIRMED" &&
                  activeGathering.status !== "CANCELLED" && (
                    <button
                      type="button"
                      className="proposal-confirm"
                      disabled={isConfirmingGathering}
                      onClick={() => void confirmProposal(match.startsAt)}
                    >
                      {isConfirmingGathering
                        ? "Confirmando…"
                        : "Confirmar esta fecha"}
                    </button>
                  )}
              </m.article>
            );
          })}
        </m.div>
      </AnimatedDialog>

      <CreateGatheringDialog
        key={createDialogKey}
        open={showCreate}
        onClose={() => setShowCreate(false)}
        prefill={createPrefill}
      />

      <GatheringManagementDialog
        open={showManageGathering}
        gathering={activeGathering}
        isSaving={isManagingGathering}
        onClose={() => setShowManageGathering(false)}
        onSave={saveGatheringSettings}
        onCancelGathering={cancelActiveGathering}
      />

      <AnimatedDialog
        open={Boolean(editingExpense) && !moduleReadOnly}
        onClose={() => setEditingExpense(null)}
        panelClassName="expense-edit-sheet"
        label="Corregir gasto"
        as="form"
        onSubmit={updateActiveExpense}
      >
        <button
          type="button"
          className="close-button"
          onClick={() => setEditingExpense(null)}
          aria-label="Cerrar"
        >
          ×
        </button>
        <span className="eyebrow">CUENTAS DEL GRUPO</span>
        <h2>Corregir gasto</h2>
        <p>El total y las transferencias se recalcularán automáticamente.</p>
        <label>
          Concepto
          <input
            value={expenseEditDescription}
            onChange={(event) => setExpenseEditDescription(event.target.value)}
            minLength={2}
            maxLength={80}
            required
          />
        </label>
        <label>
          Monto
          <div className="money-input">
            <span>$</span>
            <input
              inputMode="numeric"
              value={expenseEditAmount}
              onChange={(event) =>
                setExpenseEditAmount(formatThousands(event.target.value))
              }
              required
            />
          </div>
        </label>
        <button
          className="primary-button full"
          type="submit"
          disabled={isUpdatingExpense}
        >
          {isUpdatingExpense ? "Recalculando…" : "Guardar corrección"}
        </button>
      </AnimatedDialog>

      <AccountDialog
        profileEditor={profileEditor}
        open={showAccount}
        onClose={() => setShowAccount(false)}
        onOpenGathering={openGatheringFromHistory}
        onDuplicateGathering={(item) => void duplicateGathering(item)}
      />

      <PwaStatus />
      <AnimatedToast message={notice} />
    </main>
  );
}
