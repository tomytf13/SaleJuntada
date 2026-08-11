import { useEffect, useMemo, useState } from "react";
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
    <section className="mobile-dashboard" aria-label="Resumen de Sale Juntada">
      <div className="mobile-welcome">
        <span className="mobile-kicker"><Sparkles size={14} /> Coordinar sin vueltas</span>
        <h1>{active ? "La juntada ya está en marcha." : "Hagamos que el plan salga."}</h1>
        <p>
          {active
            ? "Respondé, compartí y cerrá el horario sin perseguir mensajes."
            : "Creá una juntada y mandá un solo link al grupo."}
        </p>
      </div>

      {confirmed ? (
        <article className="mobile-confirmed-card">
          <span className="mobile-card-label"><Check size={14} /> Fecha confirmada</span>
          <h2>¡Sale!</h2>
          <p>{confirmed.day} {confirmed.date} · {confirmed.time}</p>
          <span><MapPin size={14} /> {location}</span>
          <button type="button" onClick={onShare}>
            Compartir confirmación <Share2 size={17} />
          </button>
        </article>
      ) : active ? (
        <article className="mobile-active-card">
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
        </article>
      ) : (
        <article className="mobile-create-card">
          <div className="mobile-create-illustration"><CalendarDays size={31} /></div>
          <span className="mobile-card-label">Tu próxima juntada</span>
          <h2>Primero, lo básico.</h2>
          <p>Nombre, rango de fechas, horario y lugar. El grupo hace el resto.</p>
          <button type="button" onClick={onCreate}>
            Crear una juntada <ArrowRight size={18} />
          </button>
        </article>
      )}

      {!active && (
        <button type="button" className="mobile-demo-link" onClick={onOpenAvailability}>
          Ver una juntada de ejemplo <ChevronRight size={17} />
        </button>
      )}
    </section>
  );
}

type MobileBottomNavProps = {
  purchaseEnabled: boolean;
  onHome(): void;
  onAvailability(): void;
  onPurchase(): void;
  onMore(): void;
};

export function MobileBottomNav({
  purchaseEnabled,
  onHome,
  onAvailability,
  onPurchase,
  onMore,
}: MobileBottomNavProps) {
  return (
    <nav className="mobile-bottom-nav" aria-label="Navegación principal">
      <button type="button" onClick={onHome}><Home size={19} /><span>Inicio</span></button>
      <button type="button" onClick={onAvailability}><CalendarDays size={19} /><span>Horarios</span></button>
      <button type="button" className={!purchaseEnabled ? "locked" : ""} onClick={onPurchase}>
        <ShoppingBasket size={19} /><span>Compra</span>
      </button>
      <button type="button" onClick={onMore}><MoreHorizontal size={19} /><span>Más</span></button>
    </nav>
  );
}

type PurchaseItem = {
  id: string;
  label: string;
  unit: string;
  quantity: number;
  category: "food" | "drinks" | "other" | "alcohol";
};

type PurchaseState = {
  items: PurchaseItem[];
  includeAlcohol: boolean;
  ageConfirmed: boolean;
};

const defaultPurchaseState: PurchaseState = {
  includeAlcohol: false,
  ageConfirmed: false,
  items: [
    { id: "meat", label: "Carne", unit: "kg", quantity: 3, category: "food" },
    { id: "bread", label: "Pan", unit: "bolsas", quantity: 2, category: "food" },
    { id: "salad", label: "Ensalada", unit: "fuentes", quantity: 2, category: "food" },
    { id: "soda", label: "Gaseosas", unit: "botellas", quantity: 4, category: "drinks" },
    { id: "water", label: "Agua", unit: "botellas", quantity: 3, category: "drinks" },
    { id: "ice", label: "Hielo", unit: "bolsas", quantity: 2, category: "other" },
    { id: "charcoal", label: "Carbón", unit: "bolsas", quantity: 2, category: "other" },
    { id: "beer", label: "Cerveza", unit: "litros", quantity: 6, category: "alcohol" },
  ],
};

function readPurchaseState(storageKey: string) {
  if (typeof window === "undefined") return defaultPurchaseState;
  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored ? JSON.parse(stored) as PurchaseState : defaultPurchaseState;
  } catch {
    return defaultPurchaseState;
  }
}

type PurchasePlannerProps = {
  gatheringKey: string;
  participantCount: number;
  onNotice(message: string): void;
};

export function PurchasePlanner({ gatheringKey, participantCount, onNotice }: PurchasePlannerProps) {
  const storageKey = `sale-juntada:purchase:${gatheringKey}`;
  const [purchase, setPurchase] = useState<PurchaseState>(() => readPurchaseState(storageKey));

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(purchase));
  }, [purchase, storageKey]);

  const visibleItems = useMemo(
    () => purchase.items.filter((item) => item.category !== "alcohol" || purchase.includeAlcohol),
    [purchase],
  );

  const changeQuantity = (id: string, delta: number) => {
    setPurchase((current) => ({
      ...current,
      items: current.items.map((item) => item.id === id
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
    <section className="purchase-planner" id="compra" aria-labelledby="purchase-title">
      <div className="purchase-heading">
        <div>
          <span className="section-kicker">DESPUÉS DEL MATCH</span>
          <h2 id="purchase-title">Armemos la compra.</h2>
          <p>Una base editable para {participantCount} personas. Las cantidades quedan guardadas en este dispositivo.</p>
        </div>
        <span className="purchase-status"><Check size={15} /> Fecha cerrada</span>
      </div>

      <div className="purchase-layout">
        <div className="purchase-list-card">
          <div className="purchase-list-title">
            <div><ShoppingBasket size={21} /><strong>Lista sugerida</strong></div>
            <small>{visibleItems.filter((item) => item.quantity > 0).length} productos</small>
          </div>
          <div className="purchase-items">
            {visibleItems.map((item) => (
              <div className="purchase-item" key={item.id}>
                <span className={`purchase-item-icon ${item.category}`}>
                  {item.category === "drinks" || item.category === "alcohol" ? <GlassWater size={18} /> : <ShoppingBasket size={18} />}
                </span>
                <div><strong>{item.label}</strong><small>{item.unit}</small></div>
                <div className="quantity-stepper" aria-label={`Cantidad de ${item.label}`}>
                  <button type="button" onClick={() => changeQuantity(item.id, -1)} aria-label={`Quitar ${item.label}`}><Minus size={14} /></button>
                  <b>{item.quantity}</b>
                  <button type="button" onClick={() => changeQuantity(item.id, 1)} aria-label={`Agregar ${item.label}`}><Plus size={14} /></button>
                </div>
              </div>
            ))}
          </div>

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
              onClick={() => setPurchase((current) => ({ ...current, includeAlcohol: !current.includeAlcohol, ageConfirmed: false }))}
            ><span /></button>
          </div>
          {purchase.includeAlcohol && (
            <label className="age-confirmation">
              <input
                type="checkbox"
                checked={purchase.ageConfirmed}
                onChange={(event) => setPurchase((current) => ({ ...current, ageConfirmed: event.target.checked }))}
              />
              La compra y recepción será gestionada por una persona mayor de 18 años.
            </label>
          )}
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
    </section>
  );
}
