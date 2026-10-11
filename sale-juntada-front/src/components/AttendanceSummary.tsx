import { Link } from "react-router-dom";
import { useState } from "react";
import { Cake, Instagram } from "lucide-react";
import { gatheringService } from "../services/gatheringService";
import "./AttendanceSummary.css";
import type { Gathering } from "../services/gatheringService";
import { summarizeAttendance } from "../hooks/useRsvp";
import { ParticipantAvatar } from "./ParticipantAvatar";
import { formatAvailabilitySummary } from "../utils/availability";

const labels = { GOING: "✓ Voy", MAYBE: "? No sé", NOT_GOING: "✕ No voy" };

export function AttendanceSummary({
  gathering,
  viewerId,
  token,
  onBirthdayUpdated,
}: {
  gathering: Gathering;
  viewerId: string;
  token?: string;
  onBirthdayUpdated?(id: string, birthday: boolean): void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const canManage = Boolean(token && gathering.participants.find(p => p.id === viewerId)?.isOrganizer);
  async function toggleBirthday(id: string, birthday: boolean) {
    if (!token) return;
    setBusy(id); setError("");
    try {
      const result = await gatheringService.updateBirthday(gathering.id, viewerId, token, id, birthday);
      onBirthdayUpdated?.(result.id, result.isBirthdayPerson);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No pudimos actualizar al cumpleañero."); }
    finally { setBusy(null); }
  }
  const summary =
    gathering.rsvpSummary ?? summarizeAttendance(gathering.participants);
  return (
    <section className="attendance-summary" aria-labelledby="attendance-title">
      <span className="section-kicker">EL GRUPO</span>
      <h2 id="attendance-title">{gathering.status === "OPEN" ? "Quiénes se sumaron" : "Quiénes vienen"}</h2>
      {gathering.status !== "OPEN" ? <p className="attendance-counts" aria-live="polite">
        {summary.going} van · {summary.maybe} no saben · {summary.notGoing} no
        van · {summary.pending} sin responder
      </p> : <p>{gathering.participants.length} personas · esperando definir fecha</p>}
      {gathering.status !== "OPEN" && summary.goingHeadcount > summary.going ? (
        <p>{summary.goingHeadcount} personas contando acompañantes</p>
      ) : null}
      {canManage ? <p className="birthday-help"><Cake size={18} aria-hidden="true" />¿Es un cumpleaños? Marcá a quienes festejan. Podés elegir a más de uno.</p> : null}
      {error ? <p role="alert" className="form-error">{error}</p> : null}
      <Link className="text-link" to={`/j/${gathering.slug}/mi-parte`}>Editar mi foto e Instagram →</Link>
      <ul className="attendance-list">
        {gathering.participants.map((participant) => (
          <li key={participant.id} className={participant.isBirthdayPerson ? "birthday-guest" : ""}>
            <ParticipantAvatar
              name={participant.name}
              avatarUrl={participant.avatarUrl}
            />
            <span>
              <strong>
                {participant.name}
                {participant.id === viewerId ? " (vos)" : ""}
              </strong>
              {participant.isBirthdayPerson ? <small className="birthday-badge"><Cake size={15} aria-hidden="true" />¡Festejamos su cumple!</small> : null}
              {participant.instagramUsername ? <a className="guest-instagram" href={`https://www.instagram.com/${encodeURIComponent(participant.instagramUsername)}/`} target="_blank" rel="noreferrer"><Instagram size={15} aria-hidden="true" />@{participant.instagramUsername}</a> : null}
              {participant.isOrganizer ? <small>Organiza</small> : null}
            </span>
            <span className="attendance-answer">
              {gathering.status === "OPEN" ? formatAvailabilitySummary(participant.availabilities) : participant.rsvpStatus
                ? labels[participant.rsvpStatus]
                : "Sin responder"}
              {participant.rsvpStatus === "GOING" && participant.plusOnes
                ? ` · +${participant.plusOnes}`
                : ""}
            </span>
            {canManage ? <button type="button" className="birthday-toggle" aria-label={`${participant.isBirthdayPerson ? "Desmarcar" : "Marcar"} a ${participant.name} como cumpleañero`} aria-pressed={Boolean(participant.isBirthdayPerson)} disabled={busy !== null} onClick={() => void toggleBirthday(participant.id, !participant.isBirthdayPerson)}><Cake size={18} aria-hidden="true" /><span>{busy === participant.id ? "Guardando…" : participant.isBirthdayPerson ? "Cumpleañero" : "Marcar cumple"}</span></button> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
