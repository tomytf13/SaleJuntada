import { useRef } from "react";
import type { Participant, RsvpStatus } from "../services/gatheringService";

const choices = [
  { status: "GOING", label: "Voy", icon: "✓" },
  { status: "MAYBE", label: "No sé", icon: "?" },
  { status: "NOT_GOING", label: "No voy", icon: "✕" },
] as const;

export function RsvpSelector({
  participant,
  pending,
  error,
  onChange,
}: {
  participant: Participant;
  pending: boolean;
  error?: string;
  onChange(status: RsvpStatus, plusOnes: number): void;
}) {
  const radios = useRef<Array<HTMLButtonElement | null>>([]);
  return (
    <section
      className="rsvp-section"
      aria-labelledby="rsvp-title"
      aria-busy={pending}
    >
      <span className="section-kicker">TU RESPUESTA</span>
      <h2 id="rsvp-title">¿Venís, {participant.name}?</h2>
      <div
        className="rsvp-options"
        role="radiogroup"
        aria-label="Tu asistencia"
      >
        {choices.map((choice, index) => (
          <button
            key={choice.status}
            ref={(element) => {
              radios.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={participant.rsvpStatus === choice.status}
            disabled={pending}
            tabIndex={
              participant.rsvpStatus === choice.status ||
              (!participant.rsvpStatus && index === 0)
                ? 0
                : -1
            }
            className={`rsvp-choice ${choice.status.toLowerCase()} ${participant.rsvpStatus === choice.status ? "selected" : ""}`}
            onClick={() => onChange(choice.status, participant.plusOnes ?? 0)}
            onKeyDown={(event) => {
              const direction =
                event.key === "ArrowRight" || event.key === "ArrowDown"
                  ? 1
                  : event.key === "ArrowLeft" || event.key === "ArrowUp"
                    ? -1
                    : 0;
              if (!direction) return;
              event.preventDefault();
              const next =
                (index + direction + choices.length) % choices.length;
              radios.current[next]?.focus();
              onChange(choices[next].status, participant.plusOnes ?? 0);
            }}
          >
            <span aria-hidden="true">{choice.icon}</span>
            {choice.label}
          </button>
        ))}
      </div>
      {participant.rsvpStatus === "GOING" ? (
        <div className="plus-ones" role="group" aria-label="Acompañantes">
          <span>¿Venís con alguien?</span>
          <button
            type="button"
            aria-label="Quitar acompañante"
            disabled={pending || !participant.plusOnes}
            onClick={() => onChange("GOING", (participant.plusOnes ?? 0) - 1)}
          >
            −
          </button>
          <output aria-live="polite">{participant.plusOnes ?? 0}</output>
          <button
            type="button"
            aria-label="Agregar acompañante"
            disabled={pending || (participant.plusOnes ?? 0) >= 10}
            onClick={() => onChange("GOING", (participant.plusOnes ?? 0) + 1)}
          >
            +
          </button>
        </div>
      ) : null}
      <p role="status">
        {pending
          ? "Guardando tu respuesta…"
          : participant.rsvpStatus
            ? "Tu respuesta está guardada. Podés cambiarla cuando quieras."
            : "Elegí una opción para avisarle al grupo."}
      </p>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
