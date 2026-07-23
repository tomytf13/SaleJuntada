"use client";

import { FormEvent, useMemo, useState } from "react";

type Slot = {
  id: string;
  day: string;
  date: string;
  time: string;
};

const slots: Slot[] = [
  { id: "fri-21", day: "Vie", date: "25 Jul", time: "21:00" },
  { id: "sat-13", day: "Sáb", date: "26 Jul", time: "13:00" },
  { id: "sat-21", day: "Sáb", date: "26 Jul", time: "21:00" },
  { id: "sun-13", day: "Dom", date: "27 Jul", time: "13:00" },
  { id: "sun-20", day: "Dom", date: "27 Jul", time: "20:00" },
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

export default function Home() {
  const [eventName, setEventName] = useState("Asado con los pibes");
  const [location, setLocation] = useState("Yerba Buena");
  const [yourSlots, setYourSlots] = useState<string[]>(["fri-21", "sat-21", "sun-20"]);
  const [showCreate, setShowCreate] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [confirmedSlot, setConfirmedSlot] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

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
  }, [yourSlots]);

  const toggleSlot = (slotId: string) => {
    setConfirmedSlot(null);
    setYourSlots((current) =>
      current.includes(slotId)
        ? current.filter((id) => id !== slotId)
        : [...current, slotId],
    );
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

  const createEvent = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    const place = String(form.get("place") || "").trim();
    if (title) setEventName(title);
    if (place) setLocation(place);
    setShowCreate(false);
    setNotice("Juntada creada. Ahora compartila con el grupo.");
    window.setTimeout(() => setNotice(""), 2800);
  };

  const confirmProposal = (slotId: string) => {
    setConfirmedSlot(slotId);
    setShowResults(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirmed = slots.find((slot) => slot.id === confirmedSlot);

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="Sale Juntada, inicio">
          <span className="brand-mark"><SparkIcon /></span>
          <span>Sale Juntada</span>
        </a>
        <div className="header-actions">
          <button className="icon-button" aria-label="Notificaciones">●</button>
          <button className="avatar-button" aria-label="Tu perfil">TF</button>
        </div>
      </header>

      <section className="hero" id="inicio">
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

        <div className="match-card" aria-label="Ejemplo de coincidencia">
          <div className="match-card-top">
            <span className="mini-label">Mejor coincidencia</span>
            <span className="match-pill"><SparkIcon /> Match perfecto</span>
          </div>
          <div className="date-lockup">
            <div className="calendar-page">
              <span>SÁB</span>
              <strong>26</strong>
            </div>
            <div>
              <h2>Este sábado</h2>
              <p>21:00 · {location}</p>
            </div>
          </div>
          <div className="people-row">
            <div className="avatar-stack" aria-label="6 personas disponibles">
              {friends.slice(0, 4).map((friend) => (
                <span key={friend.name} className={`person-avatar ${friend.color}`}>{friend.initials}</span>
              ))}
              <span className="person-avatar more">+2</span>
            </div>
            <p><strong>¡Pueden todos!</strong><br />6 de 6 confirmaron</p>
          </div>
          <div className="progress-track"><span /></div>
          <div className="ai-note"><SparkIcon /> La IA analizó 30 combinaciones para encontrar este horario.</div>
        </div>
      </section>

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
              {slots.map((slot) => {
                const selected = yourSlots.includes(slot.id);
                return (
                  <button
                    key={slot.id}
                    className={`slot-button ${selected ? "selected" : ""}`}
                    aria-pressed={selected}
                    onClick={() => toggleSlot(slot.id)}
                  >
                    <span>{slot.day}</span>
                    <strong>{slot.date.split(" ")[0]}</strong>
                    <small>{slot.date.split(" ")[1]} · {slot.time}</small>
                    <i>{selected ? "✓" : "+"}</i>
                  </button>
                );
              })}
            </div>

            <div className="your-status">
              <span className="person-avatar coral">VO</span>
              <div><strong>Tu disponibilidad</strong><small>Se guarda automáticamente</small></div>
              <span className="saved-dot">● Guardado</span>
            </div>
          </div>

          <aside className="group-card">
            <div className="card-title-row">
              <div>
                <h3>El grupo</h3>
                <p>6 personas invitadas</p>
              </div>
              <span className="response-pill">6/6 respondieron</span>
            </div>
            <div className="friend-list">
              {friends.map((friend) => (
                <div className="friend-row" key={friend.name}>
                  <span className={`person-avatar ${friend.color}`}>{friend.initials}</span>
                  <div><strong>{friend.name}</strong><small>{friend.available.length} horarios disponibles</small></div>
                  <span className="check">✓</span>
                </div>
              ))}
              <div className="friend-row">
                <span className="person-avatar coral">VO</span>
                <div><strong>Vos</strong><small>{yourSlots.length} horarios disponibles</small></div>
                <span className="check">✓</span>
              </div>
            </div>
          </aside>
        </div>

        <button className="find-button" onClick={() => setShowResults(true)}>
          <SparkIcon /> Encontrar el mejor momento
        </button>
        <p className="find-caption">Analizamos todas las disponibilidades y te damos las mejores opciones.</p>
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

      <footer>
        <a className="brand" href="#inicio"><span className="brand-mark"><SparkIcon /></span><span>Sale Juntada</span></a>
        <p>Hecho para que los planes salgan.</p>
        <span>Argentina · 2026</span>
      </footer>

      {showResults && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowResults(false)}>
          <section className="results-sheet" role="dialog" aria-modal="true" aria-labelledby="results-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="close-button" onClick={() => setShowResults(false)} aria-label="Cerrar">×</button>
            <span className="eyebrow"><SparkIcon /> Análisis listo</span>
            <h2 id="results-title">Estas son las mejores opciones</h2>
            <p>Ordenadas para que se sume la mayor cantidad de gente.</p>
            <div className="proposal-list">
              {rankedSlots.slice(0, 3).map((slot, index) => (
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
              Zona o lugar tentativo
              <input name="place" defaultValue={location} placeholder="Ej. Centro, casa de Nico..." />
            </label>
            <div className="form-row">
              <label>Desde<input name="from" type="date" defaultValue="2026-07-25" /></label>
              <label>Hasta<input name="to" type="date" defaultValue="2026-07-27" /></label>
            </div>
            <button className="primary-button full" type="submit">Crear y elegir horarios <span>→</span></button>
            <small className="privacy-note">Nadie necesita registrarse para responder.</small>
          </form>
        </div>
      )}

      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
