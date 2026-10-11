import { gatheringLocation } from "../utils/gatheringLocation";
import { CalendarDays, Clock3, MapPin, Navigation, ExternalLink } from "lucide-react";
import type { Gathering } from "../services/gatheringService";
import "./GatheringDatePlace.css";

export function GatheringDatePlace({ gathering }: { gathering: Gathering }) {
  const { address, hasPoint, query, directionsUrl } = gatheringLocation(gathering);
  const start = gathering.finalizedStart ? new Date(gathering.finalizedStart) : null;
  const end = gathering.finalizedEnd ? new Date(gathering.finalizedEnd) : null;
  const date = new Intl.DateTimeFormat("es-AR", { timeZone: gathering.timeZone, weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const time = new Intl.DateTimeFormat("es-AR", { timeZone: gathering.timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const zoneLabel = start ? new Intl.DateTimeFormat("es-AR", { timeZone: gathering.timeZone, timeZoneName: "shortOffset" }).formatToParts(start).find((part) => part.type === "timeZoneName")?.value : null;
  const minutes = start && end ? Math.round((end.getTime() - start.getTime()) / 60000) : 0;
  const duration = [Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)} h` : "", minutes % 60 ? `${minutes % 60} min` : ""].filter(Boolean).join(" ");

  return (
    <div className="date-place-details">
      <section className="event-time-card" aria-labelledby="event-time-title">
        <div className="date-place-heading"><CalendarDays size={22} aria-hidden="true" /><h3 id="event-time-title">Cuándo nos juntamos</h3></div>
        {start ? <>
          <dl className="event-time-grid">
            <div><dt>Empieza</dt><dd><strong>{time.format(start)}</strong><span>{date.format(start)}</span></dd></div>
            {end ? <div><dt>Termina</dt><dd><strong>{time.format(end)}</strong><span>{date.format(end)}</span></dd></div> : null}
          </dl>
          <div className="event-time-footer">
            {minutes > 0 ? <span><Clock3 size={16} aria-hidden="true" />Duración: {duration}</span> : null}
            <small>Horario local{zoneLabel ? ` · ${zoneLabel}` : ""}</small>
          </div>
        </> : <p>La fecha todavía está por definir. Elegí tus horarios disponibles más abajo.</p>}
      </section>
      <section className="event-place-card" aria-labelledby="event-place-title">
        <div className="event-place-info">
          <div className="date-place-heading"><MapPin size={22} aria-hidden="true" /><h3 id="event-place-title">Dónde nos encontramos</h3></div>
          <p className="event-address">{address || (hasPoint ? "Ubicación marcada por el organizador" : "Lugar a definir")}</p>
          {query ? <div className="event-map-actions">
            <a className="event-directions" href={directionsUrl!} target="_blank" rel="noreferrer"><Navigation size={17} aria-hidden="true" />Cómo llegar</a>
            <a href={`https://www.google.com/maps/search/?api=1&query=${query}`} target="_blank" rel="noreferrer">Abrir en Google Maps<ExternalLink size={15} aria-hidden="true" /></a>
          </div> : <p>El organizador todavía no indicó una ubicación.</p>}
        </div>
        {query ? <>
          <iframe
            key={query}
            className="event-location-map"
            title={`Mapa de ${address || gathering.title}`}
            src={`https://maps.google.com/maps?q=${query}&z=16&hl=es&output=embed`}
            loading="lazy"
            referrerPolicy="no-referrer"
            allowFullScreen
          />
          <p className="event-map-caption">{hasPoint ? "Punto guardado para la juntada." : "Mapa según la dirección indicada. Revisá la dirección completa, incluido el piso o departamento."} Si no carga, podés abrirlo en Google Maps.</p>
        </> : null}
      </section>
    </div>
  );
}
