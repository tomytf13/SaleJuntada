import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  GlassWater,
  Home,
  MapPin,
  MoreHorizontal,
  Share2,
  ShoppingBasket,
  Sparkles,
  UserRoundCheck,
  Users,
  Wifi,
} from "lucide-react";
import type { AppSection } from "../hooks/useActiveSection";
import {
  gatheringService,
  type DietaryPreference,
  type CatalogProduct,
  type MealArrangement,
  type Participant,
  type PurchaseItem,
  type PurchasePlan,
} from "../services/gatheringService";
import { PurchaseCatalogSelector } from "./PurchaseCatalogSelector";
import {
  listItemVariants,
  listVariants,
  springTransition,
  standardTransition,
} from "../motion/config";

type MatchPreview = {
  weekday: string;
  day: string;
  title: string;
  detail: string;
  available: number;
  total: number;
  pill: string;
};

type ConfirmedPlan = {
  day: string;
  date: string;
  time: string;
};

type MobileDashboardProps = {
  eventName: string;
  location: string;
  active: boolean;
  selectedCount: number;
  responseCount: number;
  match: MatchPreview;
  confirmed?: ConfirmedPlan;
  onCreate(): void;
  onShare(): void;
  onOpenAvailability(): void;
  onOpenResults(): void;
};

export function MobileDashboard({
  eventName,
  location,
  active,
  selectedCount,
  responseCount,
  match,
  confirmed,
  onCreate,
  onShare,
  onOpenAvailability,
  onOpenResults,
}: MobileDashboardProps) {
  return (
    <m.section
      className="mobile-dashboard"
      aria-label="Resumen de Sale Juntada"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={standardTransition}
    >
      <m.div
        className="mobile-welcome"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={standardTransition}
      >
        <span className="mobile-kicker">
          <Sparkles size={14} /> Coordinar sin vueltas
        </span>
        <h1>
          {active
            ? "La juntada ya está en marcha."
            : "Hagamos que el plan salga."}
        </h1>
        <p>
          {active
            ? "Respondé, compartí y cerrá el horario sin perseguir mensajes."
            : "Creá una juntada y mandá un solo link al grupo."}
        </p>
      </m.div>

      <AnimatePresence mode="wait" initial={false}>
        {confirmed ? (
          <m.article
            className="mobile-confirmed-card"
            key="confirmed"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.99 }}
            transition={springTransition}
          >
            <span className="mobile-card-label">
              <Check size={14} /> Fecha confirmada
            </span>
            <h2>¡Sale!</h2>
            <p>
              {confirmed.day} {confirmed.date} · {confirmed.time}
            </p>
            <span>
              <MapPin size={14} /> {location}
            </span>
            <button type="button" onClick={onShare}>
              Compartir confirmación <Share2 size={17} />
            </button>
          </m.article>
        ) : active ? (
          <m.article
            className="mobile-active-card"
            key="active"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.99 }}
            transition={springTransition}
          >
            <div className="mobile-card-heading">
              <div>
                <span className="mobile-card-label">Juntada activa</span>
                <h2>{eventName}</h2>
              </div>
              <button
                type="button"
                className="mobile-icon-action"
                onClick={onShare}
                aria-label="Compartir juntada"
              >
                <Share2 size={18} />
              </button>
            </div>
            <div className="mobile-event-facts">
              <span>
                <MapPin size={15} /> {location}
              </span>
              <span>
                <Users size={15} /> {responseCount}/{match.total} respondieron
              </span>
            </div>
            <div className="mobile-match-preview">
              <div className="mobile-calendar-tile">
                <small>{match.weekday}</small>
                <strong>{match.day}</strong>
              </div>
              <div>
                <span>{match.pill}</span>
                <strong>{match.title}</strong>
                <small>{match.detail}</small>
              </div>
              <b>
                {match.available}/{match.total}
              </b>
            </div>
            <div className="mobile-card-actions">
              <button
                type="button"
                className="mobile-primary-action"
                onClick={onOpenAvailability}
              >
                <CalendarDays size={17} />{" "}
                {selectedCount > 0 ? "Editar mis horarios" : "Marcar horarios"}
              </button>
              <button
                type="button"
                className="mobile-secondary-action"
                onClick={onOpenResults}
              >
                Ver resultados <ChevronRight size={17} />
              </button>
            </div>
          </m.article>
        ) : (
          <m.article
            className="mobile-create-card"
            key="create"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.99 }}
            transition={springTransition}
          >
            <div className="mobile-create-illustration">
              <CalendarDays size={31} />
            </div>
            <span className="mobile-card-label">Tu próxima juntada</span>
            <h2>Primero, lo básico.</h2>
            <p>
              Nombre, rango de fechas, horario y lugar. El grupo hace el resto.
            </p>
            <button type="button" onClick={onCreate}>
              Crear una juntada <ArrowRight size={18} />
            </button>
          </m.article>
        )}
      </AnimatePresence>

      {!active && (
        <button
          type="button"
          className="mobile-demo-link"
          onClick={onOpenAvailability}
        >
          Ver una juntada de ejemplo <ChevronRight size={17} />
        </button>
      )}
    </m.section>
  );
}

type MobileBottomNavProps = {
  activeSection: AppSection;
  purchaseEnabled: boolean;
  onHome(): void;
  onAvailability(): void;
  onPurchase(): void;
  onMore(): void;
};

export function MobileBottomNav({
  activeSection,
  purchaseEnabled,
  onHome,
  onAvailability,
  onPurchase,
  onMore,
}: MobileBottomNavProps) {
  return (
    <nav className="mobile-bottom-nav" aria-label="Navegación principal">
      <button
        type="button"
        className={activeSection === "home" ? "active" : ""}
        onClick={onHome}
      >
        {activeSection === "home" ? (
          <m.span
            className="mobile-nav-indicator"
            layoutId="mobile-nav-indicator"
          />
        ) : null}
        <Home size={19} />
        <span>Inicio</span>
      </button>
      <button
        type="button"
        className={activeSection === "availability" ? "active" : ""}
        onClick={onAvailability}
      >
        {activeSection === "availability" ? (
          <m.span
            className="mobile-nav-indicator"
            layoutId="mobile-nav-indicator"
          />
        ) : null}
        <CalendarDays size={19} />
        <span>Horarios</span>
      </button>
      <button
        type="button"
        className={`${!purchaseEnabled ? "locked" : ""} ${activeSection === "purchase" ? "active" : ""}`.trim()}
        onClick={onPurchase}
      >
        {activeSection === "purchase" ? (
          <m.span
            className="mobile-nav-indicator"
            layoutId="mobile-nav-indicator"
          />
        ) : null}
        <ShoppingBasket size={19} />
        <span>Compra</span>
      </button>
      <button
        type="button"
        className={activeSection === "more" ? "active" : ""}
        onClick={onMore}
      >
        {activeSection === "more" ? (
          <m.span
            className="mobile-nav-indicator"
            layoutId="mobile-nav-indicator"
          />
        ) : null}
        <MoreHorizontal size={19} />
        <span>Más</span>
      </button>
    </nav>
  );
}

const purchaseCatalog: Array<
  Omit<
    PurchaseItem,
    | "quantity"
    | "suggestedQuantity"
    | "assignedTo"
    | "assignedAt"
    | "isReady"
    | "contributions"
  > & { suggest(people: number): number }
> = [
  {
    key: "meat",
    label: "Comida principal",
    unit: "aportes",
    category: "food",
    position: 0,
    suggest: () => 1,
  },
  {
    key: "salad",
    label: "Acompañamientos",
    unit: "aportes",
    category: "food",
    position: 1,
    suggest: () => 1,
  },
  {
    key: "snacks",
    label: "Snacks",
    unit: "aportes",
    category: "food",
    position: 2,
    suggest: () => 1,
  },
  {
    key: "dessert",
    label: "Postre",
    unit: "aportes",
    category: "food",
    position: 3,
    suggest: () => 1,
  },
  {
    key: "soda",
    label: "Gaseosas y bebidas sin alcohol",
    unit: "aportes",
    category: "drinks",
    position: 4,
    suggest: () => 1,
  },
  {
    key: "ice",
    label: "Hielo",
    unit: "bolsas",
    category: "other",
    position: 5,
    suggest: () => 1,
  },
  {
    key: "charcoal",
    label: "Parrilla y fuego",
    unit: "aportes",
    category: "other",
    position: 6,
    suggest: () => 1,
  },
  {
    key: "beer",
    label: "Bebidas con alcohol",
    unit: "aportes",
    category: "alcohol",
    position: 7,
    suggest: () => 1,
  },
  {
    key: "other",
    label: "Otros",
    unit: "aportes",
    category: "other",
    position: 8,
    suggest: () => 1,
  },
];

const purchaseVisuals: Record<
  string,
  { main: string; detail: string; caption: string }
> = {
  meat: { main: "🍽️", detail: "🔥", caption: "El plato principal" },
  salad: { main: "🥗", detail: "🥖", caption: "Para acompañar" },
  snacks: { main: "🍿", detail: "🥜", caption: "Papas, maní y más" },
  dessert: { main: "🍰", detail: "🍨", caption: "Cierre dulce" },
  soda: { main: "🥤", detail: "🫧", caption: "Elegí cuál llevás" },
  ice: { main: "🧊", detail: "❄️", caption: "Clave del plan" },
  charcoal: { main: "🔥", detail: "🪵", caption: "Carbón, leña y más" },
  beer: { main: "🍻", detail: "🍷", caption: "Sólo +18" },
  other: { main: "🛍️", detail: "✨", caption: "Lo que haga falta" },
};

const dietaryOptions: Array<{
  value: DietaryPreference;
  label: string;
  icon: string;
}> = [
  { value: "CELIAC", label: "Sin gluten / celiaquía", icon: "🌾" },
  { value: "VEGAN", label: "Vegano", icon: "🌱" },
  { value: "VEGETARIAN", label: "Vegetariano", icon: "🥬" },
];

const dietaryLabels = new Map(
  dietaryOptions.map((option) => [option.value, option.label]),
);

function purchaseAssigneeInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function PurchaseAssigneeAvatar({
  assignee,
}: {
  assignee: NonNullable<PurchaseItem["assignedTo"]>;
}) {
  if (assignee.avatarUrl?.startsWith("emoji:")) {
    return <span aria-hidden="true">{assignee.avatarUrl.slice(6)}</span>;
  }
  if (assignee.avatarUrl) {
    return <img src={assignee.avatarUrl} alt="" />;
  }
  return (
    <span aria-hidden="true">{purchaseAssigneeInitials(assignee.name)}</span>
  );
}

function createSuggestedPlan(participantCount: number): PurchasePlan {
  return {
    id: null,
    persisted: false,
    includeAlcohol: false,
    ageConfirmed: false,
    participantCount,
    participantBaseline: participantCount,
    updatedAt: null,
    items: purchaseCatalog.map(({ suggest, ...item }) => {
      const quantity = suggest(participantCount);
      return {
        ...item,
        quantity,
        suggestedQuantity: quantity,
        assignedTo: null,
        assignedAt: null,
        isReady: false,
        contributions: [],
      };
    }),
  };
}

function readPurchasePlan(storageKey: string, participantCount: number) {
  const fallback = createSuggestedPlan(participantCount);
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored) as PurchasePlan;
    const parsedItems = new Map(parsed.items?.map((item) => [item.key, item]));
    return {
      ...fallback,
      ...parsed,
      items: fallback.items.map((item) => ({
        ...item,
        ...parsedItems.get(item.key),
        assignedTo: parsedItems.get(item.key)?.assignedTo ?? null,
        assignedAt: parsedItems.get(item.key)?.assignedAt ?? null,
        isReady: parsedItems.get(item.key)?.isReady ?? false,
        contributions: parsedItems.get(item.key)?.contributions ?? [],
      })),
    };
  } catch {
    return fallback;
  }
}

type PurchasePlannerProps = {
  gatheringKey: string;
  gatheringId?: string;
  participantId?: string;
  participantToken?: string;
  canEdit?: boolean;
  remoteRevision?: number;
  isLiveConnected?: boolean;
  participantCount: number;
  participants?: Participant[];
  currentParticipant?: Participant;
  onDietaryUpdated?(participant: Participant): void;
  onRequireParticipant?(): void;
  onNotice(message: string): void;
};

export function PurchasePlanner({
  gatheringKey,
  gatheringId,
  participantId,
  participantToken,
  canEdit = false,
  remoteRevision = 0,
  isLiveConnected = false,
  participantCount,
  participants = [],
  currentParticipant,
  onDietaryUpdated,
  onRequireParticipant,
  onNotice,
}: PurchasePlannerProps) {
  const storageKey = `sale-juntada:purchase:v2:${gatheringKey}`;
  const [purchase, setPurchase] = useState<PurchasePlan>(() =>
    readPurchasePlan(storageKey, participantCount),
  );
  const [isLoading, setIsLoading] = useState(Boolean(gatheringId));
  const [isSaving, setIsSaving] = useState(false);
  const [pendingResponsibilityKey, setPendingResponsibilityKey] = useState<
    string | null
  >(null);
  const [editingContributionKey, setEditingContributionKey] = useState<
    string | null
  >(null);
  const [contributionDraft, setContributionDraft] = useState({
    catalogProductId: "",
    catalogPresentationId: "",
    description: "",
    quantity: 1,
    unit: "unidad",
    note: "",
  });
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [catalogUnavailable, setCatalogUnavailable] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [dietaryPreferences, setDietaryPreferences] = useState<
    DietaryPreference[]
  >(currentParticipant?.dietaryPreferences ?? []);
  const [mealArrangement, setMealArrangement] =
    useState<MealArrangement | null>(
      currentParticipant?.mealArrangement ?? null,
    );
  const [isDietarySaving, setIsDietarySaving] = useState(false);
  const editVersionRef = useRef(0);
  const noticeRef = useRef(onNotice);
  const editable = !gatheringId || canEdit;

  useEffect(() => {
    noticeRef.current = onNotice;
  }, [onNotice]);

  useEffect(() => {
    let cancelled = false;
    gatheringService
      .getPurchaseCatalog()
      .then((catalog) => {
        if (cancelled) return;
        setCatalogProducts(catalog.products);
        setCatalogUnavailable(false);
      })
      .catch(() => {
        if (!cancelled) setCatalogUnavailable(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (gatheringId) return;
    window.localStorage.setItem(storageKey, JSON.stringify(purchase));
  }, [gatheringId, purchase, storageKey]);

  useEffect(() => {
    if (!gatheringId) return;
    let cancelled = false;
    gatheringService
      .getPurchasePlan(gatheringId)
      .then((plan) => {
        if (cancelled) return;
        setPurchase(plan);
        setIsDirty(false);
      })
      .catch(() => {
        if (!cancelled)
          noticeRef.current("No pudimos actualizar la compra compartida.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gatheringId, participantCount, remoteRevision]);

  useEffect(() => {
    if (
      !gatheringId ||
      !participantId ||
      !participantToken ||
      !canEdit ||
      !isDirty
    )
      return;
    const version = editVersionRef.current;
    const timeout = window.setTimeout(() => {
      setIsSaving(true);
      gatheringService
        .updatePurchasePlan(gatheringId, participantId, participantToken, {
          includeAlcohol: purchase.includeAlcohol,
          ageConfirmed: purchase.ageConfirmed,
          items: purchase.items.map(({ key, quantity }) => ({ key, quantity })),
        })
        .then((saved) => {
          if (editVersionRef.current !== version) return;
          setPurchase(saved);
          setIsDirty(false);
        })
        .catch(() =>
          noticeRef.current(
            "No pudimos guardar la compra. Tus cambios siguen visibles.",
          ),
        )
        .finally(() => setIsSaving(false));
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [
    canEdit,
    gatheringId,
    isDirty,
    participantId,
    participantToken,
    purchase,
  ]);

  const updatePurchase = (update: (current: PurchasePlan) => PurchasePlan) => {
    if (!editable) {
      onNotice("Sólo quien organiza puede editar la compra.");
      return;
    }
    editVersionRef.current += 1;
    setPurchase(update);
    setIsDirty(Boolean(gatheringId));
  };

  const visibleItems = useMemo(
    () =>
      purchase.items.filter(
        (item) => item.category !== "alcohol" || purchase.includeAlcohol,
      ),
    [purchase],
  );
  const responsibilityItems = useMemo(
    () => visibleItems.filter((item) => item.quantity > 0),
    [visibleItems],
  );
  const coveredCount = responsibilityItems.filter(
    (item) => item.contributions.length > 0,
  ).length;
  const readyCount = responsibilityItems.flatMap(
    (item) => item.contributions,
  ).filter((contribution) => contribution.isReady).length;
  const activeParticipantId =
    participantId ?? (!gatheringId ? "demo-user" : undefined);

  const toggleDietaryPreference = (preference: DietaryPreference) => {
    setDietaryPreferences((current) =>
      current.includes(preference)
        ? current.filter((candidate) => candidate !== preference)
        : [...current, preference],
    );
  };

  const saveDietaryProfile = async () => {
    if (!gatheringId || !participantId || !participantToken) {
      onRequireParticipant?.();
      onNotice("Entrá a la juntada para guardar tus necesidades de comida.");
      return;
    }
    if (dietaryPreferences.length > 0 && !mealArrangement) {
      onNotice("Elegí si te ocupás vos o si el grupo debe conseguir un menú.");
      return;
    }
    setIsDietarySaving(true);
    try {
      const participant = await gatheringService.updateDietaryProfile(
        gatheringId,
        participantId,
        participantToken,
        { dietaryPreferences, mealArrangement },
      );
      onDietaryUpdated?.(participant);
      onNotice(
        dietaryPreferences.length > 0
          ? "Tu necesidad alimentaria quedó visible para el grupo."
          : "Quitamos tus necesidades alimentarias.",
      );
    } catch {
      onNotice("No pudimos guardar tu necesidad alimentaria.");
    } finally {
      setIsDietarySaving(false);
    }
  };

  const openContributionForm = (item: PurchaseItem) => {
    if (!activeParticipantId) {
      onRequireParticipant?.();
      onNotice("Entrá a la juntada para sumar lo que vas a llevar.");
      return;
    }
    const mine = item.contributions.find(
      (contribution) => contribution.participant.id === activeParticipantId,
    );
    setContributionDraft({
      catalogProductId: mine?.catalogProductId ?? "",
      catalogPresentationId: mine?.catalogPresentationId ?? "",
      description: mine?.description ?? "",
      quantity: mine?.quantity ?? 1,
      unit: mine?.unit ?? "unidad",
      note: mine?.note ?? "",
    });
    setEditingContributionKey(item.key);
  };

  const saveContribution = async (item: PurchaseItem) => {
    if (
      !contributionDraft.catalogProductId &&
      contributionDraft.description.trim().length < 2
    ) {
      onNotice("Contanos qué vas a llevar, por ejemplo: Coca-Cola sin azúcar.");
      return;
    }
    let adultConfirmed = false;
    if (item.category === "alcohol") {
      adultConfirmed = window.confirm(
        "Confirmá que sos mayor de 18 años para sumar bebidas con alcohol.",
      );
      if (!adultConfirmed) return;
    }

    if (!gatheringId) {
      setPurchase((current) => ({
        ...current,
        items: current.items.map((candidate) =>
          candidate.key === item.key
            ? {
                ...candidate,
                contributions: [
                  ...candidate.contributions.filter(
                    (entry) => entry.participant.id !== "demo-user",
                  ),
                  {
                    id: `demo-${item.key}`,
                    catalogProductId: contributionDraft.catalogProductId || null,
                    catalogPresentationId:
                      contributionDraft.catalogPresentationId || null,
                    description: contributionDraft.description.trim(),
                    quantity: contributionDraft.quantity,
                    unit: contributionDraft.unit.trim(),
                    note: contributionDraft.note.trim() || null,
                    isReady: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    participant: {
                      id: "demo-user",
                      name: "Vos",
                      avatarUrl: "emoji:🎒",
                    },
                  },
                ],
              }
            : candidate,
        ),
      }));
      setEditingContributionKey(null);
      onNotice("Tu aporte quedó sumado a la mesa.");
      return;
    }
    if (!participantId || !participantToken) return;

    setPendingResponsibilityKey(item.key);
    try {
      const saved = await gatheringService.upsertPurchaseContribution(
        gatheringId,
        participantId,
        participantToken,
        item.key,
        { ...contributionDraft, adultConfirmed },
      );
      setPurchase(saved);
      setEditingContributionKey(null);
      onNotice(`Tu aporte en ${item.label} quedó visible para todos.`);
    } catch (error) {
      onNotice(
        error instanceof Error ? error.message : "No pudimos guardar tu aporte.",
      );
    } finally {
      setPendingResponsibilityKey(null);
    }
  };

  const setContributionReady = async (
    item: PurchaseItem,
    contributionId: string,
    isReady: boolean,
  ) => {
    if (!gatheringId) {
      setPurchase((current) => ({
        ...current,
        items: current.items.map((candidate) =>
          candidate.key === item.key
            ? {
                ...candidate,
                contributions: candidate.contributions.map((entry) =>
                  entry.id === contributionId ? { ...entry, isReady } : entry,
                ),
              }
            : candidate,
        ),
      }));
      return;
    }
    if (!participantId || !participantToken) return;
    setPendingResponsibilityKey(item.key);
    try {
      setPurchase(
        await gatheringService.updatePurchaseContributionStatus(
          gatheringId,
          participantId,
          participantToken,
          contributionId,
          isReady,
        ),
      );
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "No pudimos actualizar el aporte.");
    } finally {
      setPendingResponsibilityKey(null);
    }
  };

  const removeContribution = async (
    item: PurchaseItem,
    contributionId: string,
  ) => {
    if (!gatheringId) {
      setPurchase((current) => ({
        ...current,
        items: current.items.map((candidate) =>
          candidate.key === item.key
            ? {
                ...candidate,
                contributions: candidate.contributions.filter(
                  (entry) => entry.id !== contributionId,
                ),
              }
            : candidate,
        ),
      }));
      return;
    }
    if (!participantId || !participantToken) return;
    setPendingResponsibilityKey(item.key);
    try {
      setPurchase(
        await gatheringService.deletePurchaseContribution(
          gatheringId,
          participantId,
          participantToken,
          contributionId,
        ),
      );
      onNotice("Quitamos tu aporte de la mesa.");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "No pudimos quitar el aporte.");
    } finally {
      setPendingResponsibilityKey(null);
    }
  };

  const shareList = async () => {
    if (purchase.includeAlcohol && !purchase.ageConfirmed) {
      onNotice(
        "Confirmá que la compra de alcohol será gestionada por una persona mayor de 18 años.",
      );
      return;
    }
    const lines = visibleItems.flatMap((item) =>
      item.contributions.length
        ? [
            `• ${item.label}`,
            ...item.contributions.map(
              (contribution) =>
                `  - ${contribution.participant.name}: ${contribution.quantity} ${contribution.unit} de ${contribution.description}${contribution.isReady ? " (listo)" : ""}${contribution.note ? ` · ${contribution.note}` : ""}`,
            ),
          ]
        : [],
    );
    if (lines.length === 0) {
      onNotice("Todavía no hay aportes para compartir.");
      return;
    }
    const text = `Compra para la juntada (${participantCount} personas)\n${lines.join("\n")}`;
    try {
      if (navigator.share)
        await navigator.share({ title: "Compra de la juntada", text });
      else await navigator.clipboard.writeText(text);
      onNotice("Lista lista para compartir por WhatsApp.");
    } catch {
      onNotice("La lista quedó guardada en este dispositivo.");
    }
  };

  return (
    <m.section
      className="purchase-planner"
      id="compra"
      aria-labelledby="purchase-title"
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={standardTransition}
    >
      <div className="purchase-heading">
        <div>
          <span className="section-kicker">DESPUÉS DEL MATCH</span>
          <h2 id="purchase-title">Armemos la compra.</h2>
          <p>
            Una base sugerida para {participantCount} personas.
            {gatheringId
              ? " Se sincroniza con todo el grupo."
              : " En la demo queda guardada en este dispositivo."}
          </p>
        </div>
        <div className="purchase-statuses">
          <span className="purchase-status">
            <Check size={15} /> Fecha cerrada
          </span>
          <span className={`purchase-sync ${isSaving ? "saving" : ""}`}>
            {isLoading
              ? "Cargando…"
              : isSaving
                ? "Guardando…"
                : editable
                  ? "Sincronizada"
                  : participantId
                    ? "Lista compartida"
                    : "Sólo lectura"}
          </span>
        </div>
      </div>

      <section
        className="responsibility-board"
        aria-labelledby="responsibility-title"
      >
        <div className="responsibility-heading">
          <div>
            <span className="responsibility-kicker">
              <UserRoundCheck size={15} /> LA MESA DE APORTES
            </span>
            <h3 id="responsibility-title">Elegí qué vas a llevar.</h3>
            <p>
              Entrá a una categoría, especificá el producto y la cantidad. Más
              de una persona puede aportar en el mismo cuadro y el grupo lo ve
              al instante.
            </p>
          </div>
          <div className="responsibility-summary" aria-live="polite">
            <span className={isLiveConnected ? "live" : ""}>
              <Wifi size={14} />{" "}
              {isLiveConnected
                ? "En vivo"
                : gatheringId
                  ? "Sincronizando"
                  : "Modo demo"}
            </span>
            <strong>
              {coveredCount}/{responsibilityItems.length}
            </strong>
            <small>categorías con aportes · {readyCount} listos</small>
          </div>
        </div>

        <div
          className="responsibility-progress"
          aria-label={`${coveredCount} de ${responsibilityItems.length} categorías tienen aportes`}
        >
          <m.span
            initial={false}
            animate={{
              width: `${
                responsibilityItems.length > 0
                  ? (coveredCount / responsibilityItems.length) * 100
                  : 0
              }%`,
            }}
            transition={springTransition}
          />
        </div>

        <m.div
          className="responsibility-grid"
          variants={listVariants}
          initial="hidden"
          animate="visible"
        >
          <AnimatePresence initial={false}>
            {responsibilityItems.map((item) => {
              const visual = purchaseVisuals[item.key] ?? {
                main: "🛍️",
                detail: "✨",
                caption: "Aporte del grupo",
              };
              const myContribution = item.contributions.find(
                (contribution) =>
                  contribution.participant.id === activeParticipantId,
              );
              const isMine = Boolean(myContribution);
              const isReady =
                item.contributions.length > 0 &&
                item.contributions.every((contribution) => contribution.isReady);
              const isPending = pendingResponsibilityKey === item.key;
              return (
                <m.article
                  className={`responsibility-tile contribution-tile ${item.category} ${item.contributions.length ? "claimed" : "open"} ${isMine ? "mine" : ""} ${isReady ? "ready" : ""}`.trim()}
                  key={item.key}
                  layout
                  variants={listItemVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  whileHover={{ y: -4 }}
                  transition={springTransition}
                  data-testid={`responsibility-${item.key}`}
                >
                  <div
                    className={`responsibility-art ${item.key}`}
                    aria-hidden="true"
                  >
                    <span className="responsibility-art-main">
                      {visual.main}
                    </span>
                    <span className="responsibility-art-detail">
                      {visual.detail}
                    </span>
                    <small>{visual.caption}</small>
                    {isReady ? (
                      <m.b
                        className="responsibility-ready-burst"
                        initial={{ scale: 0, rotate: -16 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={springTransition}
                      >
                        <CheckCircle2 size={18} /> LISTO
                      </m.b>
                    ) : null}
                  </div>

                  <div className="responsibility-copy">
                    <div>
                      <strong>{item.label}</strong>
                      <span>{item.contributions.length} aportes</span>
                    </div>
                    {item.contributions.length ? (
                      <ul className="contribution-list">
                        {item.contributions.map((contribution) => {
                          const contributionIsMine =
                            contribution.participant.id === activeParticipantId;
                          return (
                            <li
                              key={contribution.id}
                              className={contribution.isReady ? "ready" : ""}
                            >
                              <span className="responsibility-avatar">
                                <PurchaseAssigneeAvatar
                                  assignee={contribution.participant}
                                />
                              </span>
                              <div>
                                <small>
                                  {contributionIsMine
                                    ? "VOS LLEVÁS"
                                    : contribution.participant.name}
                                </small>
                                <b>{contribution.description}</b>
                                <span>
                                  {contribution.quantity} {contribution.unit}
                                  {contribution.note
                                    ? ` · ${contribution.note}`
                                    : ""}
                                </span>
                              </div>
                              {contributionIsMine ? (
                                <div className="contribution-actions">
                                  <button
                                    type="button"
                                    disabled={isPending}
                                    aria-label={
                                      contribution.isReady
                                        ? `Marcar ${contribution.description} pendiente`
                                        : `Marcar ${contribution.description} listo`
                                    }
                                    onClick={() =>
                                      setContributionReady(
                                        item,
                                        contribution.id,
                                        !contribution.isReady,
                                      )
                                    }
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isPending}
                                    aria-label={`Quitar ${contribution.description}`}
                                    onClick={() =>
                                      removeContribution(item, contribution.id)
                                    }
                                  >
                                    ×
                                  </button>
                                </div>
                              ) : contribution.isReady ? (
                                <CheckCircle2 size={16} aria-label="Listo" />
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="responsibility-owner empty">
                        <span>+</span>
                        <p>
                          <small>TODAVÍA VACÍO</small>
                          <b>Sumá el primer aporte</b>
                        </p>
                      </div>
                    )}
                  </div>

                  {editingContributionKey === item.key ? (
                    <div className="contribution-form">
                      {catalogProducts.some(
                        (product) => product.categoryKey === item.key,
                      ) ? (
                        <PurchaseCatalogSelector
                          categoryLabel={item.label}
                          products={catalogProducts.filter(
                            (product) => product.categoryKey === item.key,
                          )}
                          selectedProductId={contributionDraft.catalogProductId}
                          selectedPresentationId={
                            contributionDraft.catalogPresentationId
                          }
                          customMode={!contributionDraft.catalogProductId}
                          onSelect={(product) => {
                            const presentation = product.presentations[0];
                            setContributionDraft((current) => ({
                              ...current,
                              catalogProductId: product.id,
                              catalogPresentationId: presentation?.id ?? "",
                              description: product.name,
                              unit: presentation?.unit ?? "unidad",
                            }));
                          }}
                          onSelectPresentation={(presentationId) => {
                            const presentation = catalogProducts
                              .find(
                                (product) =>
                                  product.id === contributionDraft.catalogProductId,
                              )
                              ?.presentations.find(
                                (candidate) => candidate.id === presentationId,
                              );
                            setContributionDraft((current) => ({
                              ...current,
                              catalogPresentationId: presentationId,
                              unit: presentation?.unit ?? current.unit,
                            }));
                          }}
                          onCustom={() =>
                            setContributionDraft((current) => ({
                              ...current,
                              catalogProductId: "",
                              catalogPresentationId: "",
                              description: "",
                              unit: "unidad",
                            }))
                          }
                        />
                      ) : null}
                      {!contributionDraft.catalogProductId ? (
                        <label>
                          ¿Qué vas a llevar?
                          <input
                            value={contributionDraft.description}
                            maxLength={120}
                            placeholder="Escribí el producto o preparación"
                            onChange={(event) =>
                              setContributionDraft((current) => ({
                                ...current,
                                description: event.target.value,
                              }))
                            }
                          />
                        </label>
                      ) : null}
                      {catalogUnavailable ? (
                        <small className="catalog-offline-note">
                          El catálogo no respondió; podés completar el aporte manualmente.
                        </small>
                      ) : null}
                      <div>
                        <label>
                          Cantidad
                          <input
                            type="number"
                            min="1"
                            max="999"
                            value={contributionDraft.quantity}
                            onChange={(event) =>
                              setContributionDraft((current) => ({
                                ...current,
                                quantity: Math.max(
                                  1,
                                  Number(event.target.value) || 1,
                                ),
                              }))
                            }
                          />
                        </label>
                        {!contributionDraft.catalogProductId ? (
                          <label>
                            Presentación
                            <input
                              value={contributionDraft.unit}
                              maxLength={32}
                              placeholder="botellas, bolsas…"
                              onChange={(event) =>
                                setContributionDraft((current) => ({
                                  ...current,
                                  unit: event.target.value,
                                }))
                              }
                            />
                          </label>
                        ) : (
                          <div className="catalog-selection-summary">
                            <span>Elegiste</span>
                            <b>{contributionDraft.description}</b>
                            <small>{contributionDraft.unit}</small>
                          </div>
                        )}
                      </div>
                      <label>
                        Nota opcional
                        <input
                          value={contributionDraft.note}
                          maxLength={180}
                          placeholder="Sabor, marca, sin azúcar…"
                          onChange={(event) =>
                            setContributionDraft((current) => ({
                              ...current,
                              note: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <div className="contribution-form-actions">
                        <button
                          type="button"
                          onClick={() => setEditingContributionKey(null)}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => saveContribution(item)}
                        >
                          {isPending ? "Guardando…" : "Guardar aporte"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <m.button
                      type="button"
                      className="responsibility-claim"
                      disabled={isPending}
                      onClick={() => openContributionForm(item)}
                      whileTap={{ scale: 0.97 }}
                    >
                      {gatheringId && !participantId
                        ? "Entrá para aportar"
                        : isMine
                          ? "Editar mi aporte"
                          : "+ Sumar mi aporte"}
                    </m.button>
                  )}
                </m.article>
              );
            })}
          </AnimatePresence>
        </m.div>
      </section>

      {gatheringId ? (
        <section className="dietary-planner" aria-labelledby="dietary-title">
          <div className="dietary-heading">
            <div>
              <span className="section-kicker">
                QUE NADIE SE QUEDE SIN COMER
              </span>
              <h3 id="dietary-title">Necesidades alimentarias</h3>
              <p>
                Marcá lo que necesitás y avisá si te ocupás vos o si el grupo
                debe conseguir una opción.
              </p>
            </div>
            <span>
              Visible sólo para quienes tienen el link de esta juntada.
            </span>
          </div>

          <div className="dietary-layout">
            <div className="dietary-form">
              <div
                className="dietary-options"
                aria-label="Preferencias alimentarias"
              >
                {dietaryOptions.map((option) => (
                  <label
                    key={option.value}
                    className={
                      dietaryPreferences.includes(option.value)
                        ? "selected"
                        : ""
                    }
                  >
                    <input
                      type="checkbox"
                      checked={dietaryPreferences.includes(option.value)}
                      onChange={() => toggleDietaryPreference(option.value)}
                    />
                    <span aria-hidden="true">{option.icon}</span>
                    <strong>{option.label}</strong>
                  </label>
                ))}
              </div>

              {dietaryPreferences.length > 0 ? (
                <div
                  className="meal-arrangement"
                  role="radiogroup"
                  aria-label="Cómo resolver tu comida"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={mealArrangement === "SELF_MANAGED"}
                    className={
                      mealArrangement === "SELF_MANAGED" ? "selected" : ""
                    }
                    onClick={() => setMealArrangement("SELF_MANAGED")}
                  >
                    <strong>Me ocupo yo</strong>
                    <small>Llevo o gestiono mi propia comida.</small>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={mealArrangement === "GROUP_MENU"}
                    className={
                      mealArrangement === "GROUP_MENU" ? "selected" : ""
                    }
                    onClick={() => setMealArrangement("GROUP_MENU")}
                  >
                    <strong>Necesito ayuda del grupo</strong>
                    <small>Hay que sumar una opción apta al menú.</small>
                  </button>
                </div>
              ) : null}

              <button
                type="button"
                className="save-dietary-button"
                disabled={isDietarySaving}
                onClick={saveDietaryProfile}
              >
                {isDietarySaving
                  ? "Guardando…"
                  : currentParticipant
                    ? "Guardar mi elección"
                    : "Entrá para completar esto"}
              </button>
            </div>

            <div className="dietary-summary">
              <strong>Menús a tener en cuenta</strong>
              {participants.some(
                (participant) =>
                  (participant.dietaryPreferences?.length ?? 0) > 0,
              ) ? (
                <ul>
                  {participants
                    .filter(
                      (participant) =>
                        (participant.dietaryPreferences?.length ?? 0) > 0,
                    )
                    .map((participant) => (
                      <li key={participant.id}>
                        <span>{participant.name}</span>
                        <b>
                          {participant.dietaryPreferences
                            ?.map((preference) => dietaryLabels.get(preference))
                            .join(" · ")}
                        </b>
                        <small>
                          {participant.mealArrangement === "SELF_MANAGED"
                            ? "Se ocupa de su comida"
                            : "El grupo busca una opción"}
                        </small>
                      </li>
                    ))}
                </ul>
              ) : (
                <p>Todavía nadie indicó una necesidad especial.</p>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <div className="purchase-layout">
        <div className="purchase-list-card">
          <div className="purchase-list-title">
            <div>
              <ShoppingBasket size={21} />
              <strong>Opciones de la mesa</strong>
            </div>
            <small>
              {visibleItems.flatMap((item) => item.contributions).length} aportes
            </small>
          </div>

          <div className="alcohol-option">
            <div>
              <span className="purchase-item-icon alcohol">
                <GlassWater size={18} />
              </span>
              <div>
                <strong>Incluir bebidas con alcohol</strong>
                <small>Opcional y bajo responsabilidad de adultos</small>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={purchase.includeAlcohol}
              className={purchase.includeAlcohol ? "active" : ""}
              disabled={!editable}
              onClick={() =>
                updatePurchase((current) => ({
                  ...current,
                  includeAlcohol: !current.includeAlcohol,
                  ageConfirmed: false,
                }))
              }
            >
              <span />
            </button>
          </div>
          <AnimatePresence initial={false}>
            {purchase.includeAlcohol ? (
              <m.label
                className="age-confirmation"
                initial={{ opacity: 0, height: 0, y: -6 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -6 }}
                transition={standardTransition}
              >
                <input
                  type="checkbox"
                  checked={purchase.ageConfirmed}
                  disabled={!editable}
                  onChange={(event) =>
                    updatePurchase((current) => ({
                      ...current,
                      ageConfirmed: event.target.checked,
                    }))
                  }
                />
                La compra y recepción será gestionada por una persona mayor de
                18 años.
              </m.label>
            ) : null}
          </AnimatePresence>
          <button
            type="button"
            className="share-purchase-button"
            onClick={shareList}
          >
            <Share2 size={18} /> Compartir lista
          </button>
        </div>
      </div>
    </m.section>
  );
}
