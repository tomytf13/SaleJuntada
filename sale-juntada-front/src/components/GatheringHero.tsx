import { Link } from "react-router-dom";
import type { Gathering } from "../services/gatheringService";

export function GatheringHero({
  gathering,
  onShare,
}: {
  gathering: Gathering;
  onShare(): void;
}) {
  const date = gathering.finalizedStart
    ? new Intl.DateTimeFormat("es-AR", {
        timeZone: gathering.timeZone,
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(gathering.finalizedStart))
    : "Buscando fecha";
  const count = gathering.participantCount ?? gathering.participants.length;
  return (
    <section
      className="gathering-hero"
      id="inicio"
      aria-labelledby="gathering-title"
    >
      <span className="section-kicker">
        {gathering.status === "CANCELLED"
          ? "JUNTADA CANCELADA"
          : gathering.isParticipant ? "TU JUNTADA" : "ESTÁS INVITADO"}
      </span>
      <h1 id="gathering-title">{gathering.title}</h1>
      {gathering.isParticipant ? <Link className="gathering-date gathering-date-link" to={`/j/${gathering.slug}/fecha`}>📅 {date} ↗</Link> : <p className="gathering-date">📅 {date}</p>}
      <p>
        📍{" "}
        {gathering.finalizedLocation ??
          gathering.locationHint ??
          "Lugar a definir"}
      </p>
      <div className="gathering-hero-footer">
        <span>
          {count}{" "}
          {count === 1 ? "persona ya se sumó" : "personas ya se sumaron"}
        </span>
        <button className="share-button" type="button" onClick={onShare}>
          Compartir invitación ↗
        </button>
      </div>
    </section>
  );
}
