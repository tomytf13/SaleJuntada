import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  GlassWater,
  Home,
  MapPin,
  Minus,
  MoreHorizontal,
  Plus,
  Share2,
  ShoppingBasket,
  Sparkles,
  Users,
} from "lucide-react";
import type { AppSection } from "../hooks/useActiveSection";
import {
  gatheringService,
  type PurchaseItem,
  type PurchasePlan,
} from "../services/gatheringService";
import {
  listItemVariants,
  listVariants,
  quickTransition,
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
        <span className="mobile-kicker"><Sparkles size={14} /> Coordinar sin vueltas</span>
        <h1>{active ? "La juntada ya está en marcha." : "Hagamos que el plan salga."}</h1>
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
          <span className="mobile-card-label"><Check size={14} /> Fecha confirmada</span>
          <h2>¡Sale!</h2>
          <p>{confirmed.day} {confirmed.date} · {confirmed.time}</p>
          <span><MapPin size={14} /> {location}</span>
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
            <button type="button" className="mobile-icon-action" onClick={onShare} aria-label="Compartir juntada">
              <Share2 size={18} />
            </button>
          </div>
          <div className="mobile-event-facts">
            <span><MapPin size={15} /> {location}</span>
            <span><Users size={15} /> {responseCount}/{match.total} respondieron</span>
          </div>
          <div className="mobile-match-preview">
            <div className="mobile-calendar-tile"><small>{match.weekday}</small><strong>{match.day}</strong></div>
            <div>
              <span>{match.pill}</span>
              <strong>{match.title}</strong>
              <small>{match.detail}</small>
            </div>
            <b>{match.available}/{match.total}</b>
          </div>
          <div className="mobile-card-actions">
            <button type="button" className="mobile-primary-action" onClick={onOpenAvailability}>
              <CalendarDays size={17} /> {selectedCount > 0 ? "Editar mis horarios" : "Marcar horarios"}
            </button>
            <button type="button" className="mobile-secondary-action" onClick={onOpenResults}>
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
          <div className="mobile-create-illustration"><CalendarDays size={31} /></div>
          <span className="mobile-card-label">Tu próxima juntada</span>
          <h2>Primero, lo básico.</h2>
          <p>Nombre, rango de fechas, horario y lugar. El grupo hace el resto.</p>
          <button type="button" onClick={onCreate}>
            Crear una juntada <ArrowRight size={18} />
          </button>
        </m.article>
      )}
      </AnimatePresence>

      {!active && (
        <button type="button" className="mobile-demo-link" onClick={onOpenAvailability}>
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
      <button type="button" className={activeSection === "home" ? "active" : ""} onClick={onHome}>
        {activeSection === "home" ? <m.span className="mobile-nav-indicator" layoutId="mobile-nav-indicator" /> : null}
        <Home size={19} /><span>Inicio</span>
      </button>
      <button type="button" className={activeSection === "availability" ? "active" : ""} onClick={onAvailability}>
        {activeSection === "availability" ? <m.span className="mobile-nav-indicator" layoutId="mobile-nav-indicator" /> : null}
        <CalendarDays size={19} /><span>Horarios</span>
      </button>
      <button
        type="button"
        className={`${!purchaseEnabled ? "locked" : ""} ${activeSection === "purchase" ? "active" : ""}`.trim()}
        onClick={onPurchase}
      >
        {activeSection === "purchase" ? <m.span className="mobile-nav-indicator" layoutId="mobile-nav-indicator" /> : null}
        <ShoppingBasket size={19} /><span>Compra</span>
      </button>
      <button type="button" className={activeSection === "more" ? "active" : ""} onClick={onMore}>
        {activeSection === "more" ? <m.span className="mobile-nav-indicator" layoutId="mobile-nav-indicator" /> : null}
        <MoreHorizontal size={19} /><span>Más</span>
      </button>
    </nav>
  );
}

const purchaseCatalog: Array<
  Omit<PurchaseItem, "quantity" | "suggestedQuantity">
  & { suggest(people: number): number }
> = [
  { key: "meat", label: "Carne", unit: "kg", category: "food", position: 0, suggest: (people) => Math.max(1, Math.ceil(people * 0.45)) },
  { key: "bread", label: "Pan", unit: "bolsas", category: "food", position: 1, suggest: (people) => Math.max(1, Math.ceil(people / 4)) },
  { key: "salad", label: "Ensalada", unit: "fuentes", category: "food", position: 2, suggest: (people) => Math.max(1, Math.ceil(people / 3)) },
  { key: "soda", label: "Gaseosas", unit: "botellas de 2 L", category: "drinks", position: 3, suggest: (people) => Math.max(1, Math.ceil(people / 2)) },
  { key: "water", label: "Agua", unit: "botellas de 2 L", category: "drinks", position: 4, suggest: (people) => Math.max(1, Math.ceil(people / 3)) },
  { key: "ice", label: "Hielo", unit: "bolsas", category: "other", position: 5, suggest: (people) => Math.max(1, Math.ceil(people / 3)) },
  { key: "charcoal", label: "Carbón", unit: "bolsas", category: "other", position: 6, suggest: (people) => Math.max(1, Math.ceil(people / 4)) },
  { key: "beer", label: "Cerveza", unit: "litros", category: "alcohol", position: 7, suggest: (people) => Math.max(1, people) },
];

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
      return { ...item, quantity, suggestedQuantity: quantity };
    }),
  };
}

function readPurchasePlan(storageKey: string, participantCount: number) {
  const fallback = createSuggestedPlan(participantCount);
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored ? { ...fallback, ...JSON.parse(stored) as PurchasePlan } : fallback;
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
  participantCount: number;
  onNotice(message: string): void;
};

export function PurchasePlanner({
  gatheringKey,
  gatheringId,
  participantId,
  participantToken,
  canEdit = false,
  remoteRevision = 0,
  participantCount,
  onNotice,
}: PurchasePlannerProps) {
  const storageKey = `sale-juntada:purchase:v2:${gatheringKey}`;
  const [purchase, setPurchase] = useState<PurchasePlan>(() =>
    readPurchasePlan(storageKey, participantCount),
  );
  const [isLoading, setIsLoading] = useState(Boolean(gatheringId));
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const editVersionRef = useRef(0);
  const noticeRef = useRef(onNotice);
  const editable = !gatheringId || canEdit;

  useEffect(() => {
    noticeRef.current = onNotice;
  }, [onNotice]);

  useEffect(() => {
    if (gatheringId) return;
    window.localStorage.setItem(storageKey, JSON.stringify(purchase));
  }, [gatheringId, purchase, storageKey]);

  useEffect(() => {
    if (!gatheringId) return;
    let cancelled = false;
    gatheringService.getPurchasePlan(gatheringId)
      .then((plan) => {
        if (cancelled) return;
        setPurchase(plan);
        setIsDirty(false);
      })
      .catch(() => {
        if (!cancelled) noticeRef.current("No pudimos actualizar la compra compartida.");
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
    ) return;
    const version = editVersionRef.current;
    const timeout = window.setTimeout(() => {
      setIsSaving(true);
      gatheringService.updatePurchasePlan(
        gatheringId,
        participantId,
        participantToken,
        {
          includeAlcohol: purchase.includeAlcohol,
          ageConfirmed: purchase.ageConfirmed,
          items: purchase.items.map(({ key, quantity }) => ({ key, quantity })),
        },
      )
        .then((saved) => {
          if (editVersionRef.current !== version) return;
          setPurchase(saved);
          setIsDirty(false);
        })
        .catch(() => noticeRef.current("No pudimos guardar la compra. Tus cambios siguen visibles."))
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
    () => purchase.items.filter((item) => item.category !== "alcohol" || purchase.includeAlcohol),
    [purchase],
  );

  const changeQuantity = (key: string, delta: number) => {
    updatePurchase((current) => ({
      ...current,
      items: current.items.map((item) => item.key === key
        ? { ...item, quantity: Math.max(0, item.quantity + delta) }
        : item),
    }));
  };

  const shareList = async () => {
    if (purchase.includeAlcohol && !purchase.ageConfirmed) {
      onNotice("Confirmá que la compra de alcohol será gestionada por una persona mayor de 18 años.");
      return;
    }
    const lines = visibleItems
      .filter((item) => item.quantity > 0)
      .map((item) => `• ${item.label}: ${item.quantity} ${item.unit}`);
    const text = `Compra para la juntada (${participantCount} personas)\n${lines.join("\n")}`;
    try {
      if (navigator.share) await navigator.share({ title: "Compra de la juntada", text });
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
            {gatheringId ? " Se sincroniza con todo el grupo." : " En la demo queda guardada en este dispositivo."}
          </p>
        </div>
        <div className="purchase-statuses">
          <span className="purchase-status"><Check size={15} /> Fecha cerrada</span>
          <span className={`purchase-sync ${isSaving ? "saving" : ""}`}>
            {isLoading ? "Cargando…" : isSaving ? "Guardando…" : editable ? "Sincronizada" : "Sólo lectura"}
          </span>
        </div>
      </div>

      <div className="purchase-layout">
        <div className="purchase-list-card">
          <div className="purchase-list-title">
            <div><ShoppingBasket size={21} /><strong>Lista sugerida</strong></div>
            <small>{visibleItems.filter((item) => item.quantity > 0).length} productos</small>
          </div>
          <m.div className="purchase-items" variants={listVariants} initial="hidden" animate="visible">
            <AnimatePresence initial={false}>
            {visibleItems.map((item) => (
              <m.div
                className="purchase-item"
                key={item.key}
                layout
                variants={listItemVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <span className={`purchase-item-icon ${item.category}`}>
                  {item.category === "drinks" || item.category === "alcohol" ? <GlassWater size={18} /> : <ShoppingBasket size={18} />}
                </span>
                <div>
                  <strong>{item.label}</strong>
                  <small>{item.unit} · sugerido {item.suggestedQuantity}</small>
                </div>
                <div className="quantity-stepper" aria-label={`Cantidad de ${item.label}`}>
                  <m.button type="button" whileTap={{ scale: 0.86 }} disabled={!editable} onClick={() => changeQuantity(item.key, -1)} aria-label={`Quitar ${item.label}`}><Minus size={14} /></m.button>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <m.b
                      key={`${item.key}-${item.quantity}`}
                      initial={{ opacity: 0, y: -6, scale: 0.85 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.85 }}
                      transition={quickTransition}
                    >{item.quantity}</m.b>
                  </AnimatePresence>
                  <m.button type="button" whileTap={{ scale: 0.86 }} disabled={!editable} onClick={() => changeQuantity(item.key, 1)} aria-label={`Agregar ${item.label}`}><Plus size={14} /></m.button>
                </div>
              </m.div>
            ))}
            </AnimatePresence>
          </m.div>

          <div className="alcohol-option">
            <div>
              <span className="purchase-item-icon alcohol"><GlassWater size={18} /></span>
              <div><strong>Incluir bebidas con alcohol</strong><small>Opcional y bajo responsabilidad de adultos</small></div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={purchase.includeAlcohol}
              className={purchase.includeAlcohol ? "active" : ""}
              disabled={!editable}
              onClick={() => updatePurchase((current) => ({ ...current, includeAlcohol: !current.includeAlcohol, ageConfirmed: false }))}
            ><span /></button>
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
                onChange={(event) => updatePurchase((current) => ({ ...current, ageConfirmed: event.target.checked }))}
              />
              La compra y recepción será gestionada por una persona mayor de 18 años.
            </m.label>
          ) : null}
          </AnimatePresence>
          <button type="button" className="share-purchase-button" onClick={shareList}>
            <Share2 size={18} /> Compartir lista
          </button>
        </div>

        <aside className="merchant-preview">
          <span><MapPin size={18} /></span>
          <small>PRÓXIMA ETAPA</small>
          <h3>Comercios de Tucumán</h3>
          <p>Acá podremos mostrar comercios que acepten figurar y mantener sus datos y WhatsApp actualizados.</p>
          <ul>
            <li><Check size={14} /> Participación voluntaria</li>
            <li><Check size={14} /> Sin ranking pago oculto</li>
            <li><Check size={14} /> Datos verificables y reportables</li>
          </ul>
          <button type="button" disabled>Ver comercios cercanos</button>
          <em>El MVP no recomienda ni procesa la compra.</em>
        </aside>
      </div>
    </m.section>
  );
}
