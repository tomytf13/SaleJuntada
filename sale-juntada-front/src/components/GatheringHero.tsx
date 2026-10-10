import {
  ArrowUpRight,
  CalendarDays,
  Clock3,
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
  const startsAt = gathering.finalizedStart
    ? new Date(gathering.finalizedStart)
    : null;
  const date = startsAt
    ? new Intl.DateTimeFormat("es-AR", {
        timeZone: gathering.timeZone,
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(startsAt)
    : "Buscando fecha";
  const time = startsAt
    ? new Intl.DateTimeFormat("es-AR", {
        timeZone: gathering.timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(startsAt)
    : null;
  const count = gathering.participantCount ?? gathering.participants.length;
  const dateContent = (
    <>
      <span className="invite-detail-icon">
        <CalendarDays size={21} aria-hidden="true" />
      </span>
      <span className="invite-detail-copy">
        <small>CUÁNDO</small>
        <strong>{date}</strong>
        {time ? (
          <span className="invite-time">
            <Clock3 size={14} aria-hidden="true" />
            {time} h
          </span>
        ) : (
          <span>El horario se define entre todos</span>
        )}
      </span>
      {gathering.isParticipant ? (
        <ArrowUpRight
          className="invite-date-arrow"
          size={18}
          aria-hidden="true"
        />
      ) : null}
    </>
  );

  return (
    <section
      className="gathering-hero invitation-card"
      id="inicio"
      aria-labelledby="gathering-title"
    >
      <div className="invite-main">
        <div className="invite-intro">
          <span className="invite-eyebrow">
            <span aria-hidden="true" />
            {gathering.status === "CANCELLED"
              ? "JUNTADA CANCELADA"
              : gathering.isParticipant
                ? "TU JUNTADA"
                : "TENÉS UNA INVITACIÓN"}
          </span>
          <div className="invite-art" aria-hidden="true">
            <span className="invite-art-orbit" />
            <Sparkles size={42} strokeWidth={1.25} />
            <span className="invite-art-dot" />
          </div>
          <h1 id="gathering-title">{gathering.title}</h1>
          <p className="invite-subtitle">
            {gathering.status === "CANCELLED"
              ? "Este encuentro fue cancelado."
              : "Lo mejor del plan: encontrarnos."}
          </p>
        </div>
        <div className="invite-details">
          {gathering.isParticipant ? (
            <Link
              className="invite-detail invite-date"
              to={`/j/${gathering.slug}/fecha`}
            >
              {dateContent}
            </Link>
          ) : (
            <div className="invite-detail invite-date">{dateContent}</div>
          )}
          <div className="invite-detail invite-place">
            <span className="invite-detail-icon">
              <MapPin size={21} aria-hidden="true" />
            </span>
            <div className="invite-detail-copy">
              <small>DÓNDE</small>
              <strong>
                {gathering.finalizedLocation ??
                  gathering.locationHint ??
                  "Lugar a definir"}
              </strong>
            </div>
          </div>
        </div>
      </div>
      <div className="invite-footer">
        <div className="invite-attendance">
          <span className="invite-people-icon" aria-hidden="true">
            <Users size={20} />
          </span>
          <span>
            <strong>
              {count}{" "}
              {count === 1 ? "persona ya se sumó" : "personas ya se sumaron"}
            </strong>
            <small>
              {gathering.isParticipant
                ? "Ya sos parte del plan"
                : "Sumate y organizate con el grupo"}
            </small>
          </span>
        </div>
        <button
          className="share-button invite-share"
          type="button"
          onClick={onShare}
        >
          <Share2 size={17} aria-hidden="true" />
          Compartir invitación
          <ArrowUpRight size={16} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
