import type { Gathering } from "../services/gatheringService";
import { summarizeAttendance } from "../hooks/useRsvp";
import { ParticipantAvatar } from "./ParticipantAvatar";
import { formatAvailabilitySummary } from "../utils/availability";

const labels = { GOING: "✓ Voy", MAYBE: "? No sé", NOT_GOING: "✕ No voy" };

export function AttendanceSummary({
  gathering,
  viewerId,
}: {
  gathering: Gathering;
  viewerId: string;
}) {
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
      <ul className="attendance-list">
        {gathering.participants.map((participant) => (
          <li key={participant.id}>
            <ParticipantAvatar
              name={participant.name}
              avatarUrl={participant.avatarUrl}
            />
            <span>
              <strong>
                {participant.name}
                {participant.id === viewerId ? " (vos)" : ""}
              </strong>
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
          </li>
        ))}
      </ul>
    </section>
  );
}
