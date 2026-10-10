import {
  ArrowUpRight,
  CalendarDays,
  MapPin,
  Share2,
  Sparkles,
  Users,
} from "lucide-react";
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
      <span className="section-kicker hero-status">
        <Sparkles size={14} aria-hidden="true" />
        {gathering.status === "CANCELLED"
          ? "JUNTADA CANCELADA"
          : gathering.isParticipant
            ? "TU JUNTADA"
            : "ESTÁS INVITADO"}
      </span>
      <h1 id="gathering-title">{gathering.title}</h1>
      {gathering.isParticipant ? (
        <Link
          className="gathering-date gathering-date-link"
          to={`/j/${gathering.slug}/fecha`}
        >
          <CalendarDays size={19} aria-hidden="true" />
          {date}
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      ) : (
        <p className="gathering-date">
          <CalendarDays size={19} aria-hidden="true" />
          {date}
        </p>
      )}
      <p className="gathering-location">
        <MapPin size={18} aria-hidden="true" />
        {gathering.finalizedLocation ??
          gathering.locationHint ??
          "Lugar a definir"}
      </p>
      <div className="gathering-hero-footer">
        <span className="gathering-people">
          <span className="people-symbol" aria-hidden="true">
            <Users size={19} />
          </span>
          {count}{" "}
          {count === 1 ? "persona ya se sumó" : "personas ya se sumaron"}
        </span>
        <button className="share-button" type="button" onClick={onShare}>
          <Share2 size={17} aria-hidden="true" />
          Compartir invitación <ArrowUpRight size={16} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
