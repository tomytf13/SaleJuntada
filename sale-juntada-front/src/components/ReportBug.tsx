import { Bug, Check, Lightbulb, X } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { AnimatedDialog } from "./AnimatedDialog";
import {
  ApiError,
  reportService,
  type ReportKind,
} from "../services/gatheringService";
import "./ReportBug.css";

export function ReportBug() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ReportKind>("BUG");
  const [description, setDescription] = useState("");
  const [phase, setPhase] = useState<"draft" | "sending" | "sent">("draft");
  const [error, setError] = useState("");
  const attempt = useRef<{
    id: string;
    kind: ReportKind;
    description: string;
  } | null>(null);

  function close() {
    if (phase === "sending") return;
    setOpen(false);
  }
  function show() {
    if (phase === "sent") {
      setPhase("draft");
      setKind("BUG");
      setDescription("");
      attempt.current = null;
    }
    setError("");
    setOpen(true);
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    const message = description.trim();
    if (message.length < 5) {
      setError("Contanos un poco más (al menos 5 caracteres).");
      return;
    }
    setPhase("sending");
    setError("");
    try {
      if (
        attempt.current?.description !== message ||
        attempt.current.kind !== kind
      )
        attempt.current = {
          id: crypto.randomUUID(),
          kind,
          description: message,
        };
      await reportService.submit(attempt.current);
      setPhase("sent");
    } catch (caught) {
      setPhase("draft");
      setError(
        caught instanceof ApiError && caught.status === 429
          ? "Mandaste varios reportes seguidos. Esperá un minuto y volvé a intentar."
          : "No pudimos enviarlo. Tu texto sigue acá para que puedas reintentar.",
      );
    }
  }
  return (
    <>
      <button
        type="button"
        className="bug-launcher"
        onClick={show}
        aria-label="Reportar un problema o sugerir una mejora"
        title="Bugs e ideas"
        aria-haspopup="dialog"
      >
        <Bug size={18} aria-hidden="true" />
        <span>Bugs e ideas</span>
      </button>
      <AnimatedDialog
        open={open}
        onClose={close}
        label="Bugs e ideas"
        panelClassName="create-sheet bug-sheet"
      >
        <button
          type="button"
          className="close-button"
          aria-label="Cerrar"
          disabled={phase === "sending"}
          onClick={close}
        >
          <X size={20} />
        </button>
        {phase === "sent" ? (
          <div role="status">
            <Check aria-hidden="true" />
            <h2>¡Gracias por avisarnos!</h2>
            <p>
              El equipo de Sale Juntada recibió{" "}
              {kind === "BUG" ? "tu reporte" : "tu idea"}.
            </p>
            <button type="button" className="primary-button" onClick={close}>
              Listo
            </button>
          </div>
        ) : (
          <form onSubmit={send}>
            <h2>Bugs e ideas</h2>
            <fieldset disabled={phase === "sending"}>
              <legend>¿Qué querés compartir?</legend>
              <div className="bug-options">
                {(["BUG", "IDEA"] as const).map((type) => (
                  <label key={type}>
                    <input
                      type="radio"
                      name="report-kind"
                      checked={kind === type}
                      onChange={() => setKind(type)}
                    />
                    {type === "BUG" ? (
                      <Bug size={18} aria-hidden="true" />
                    ) : (
                      <Lightbulb size={18} aria-hidden="true" />
                    )}
                    {type === "BUG" ? "Encontré un problema" : "Tengo una idea"}
                  </label>
                ))}
              </div>
              <label className="bug-description">
                {kind === "BUG"
                  ? "¿Qué pasó y en qué pantalla?"
                  : "¿Qué te gustaría mejorar?"}
                <textarea
                  required
                  minLength={5}
                  maxLength={2000}
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <small>
                Lo lee el equipo de Sale Juntada. Evitá incluir datos
                personales.
              </small>
            </fieldset>
            {error && <p role="alert">{error}</p>}
            <button
              className="primary-button"
              type="submit"
              disabled={phase === "sending"}
            >
              {phase === "sending"
                ? "Enviando…"
                : kind === "BUG"
                  ? "Enviar reporte"
                  : "Enviar idea"}
            </button>
          </form>
        )}
      </AnimatedDialog>
    </>
  );
}
