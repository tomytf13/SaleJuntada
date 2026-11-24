import { useState, type FormEvent } from "react";
import { Instagram, Star } from "lucide-react";
import type { AppFeedback } from "../services/gatheringService";
import "./GatheringFeedback.css";

export function GatheringFeedback({
  saved,
  onSave,
}: {
  saved?: AppFeedback | null;
  onSave(feedback: AppFeedback): Promise<void>;
}) {
  const [stars, setStars] = useState(saved?.stars ?? 0);
  const [comment, setComment] = useState(saved?.comment ?? "");
  const [editing, setEditing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError("");
    try {
      await onSave({ stars, comment: comment.trim() });
      setEditing(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No pudimos guardar tu opinión. Probá otra vez.",
      );
    } finally {
      setSending(false);
    }
  }
  return (
    <section className="gathering-feedback" aria-labelledby="feedback-title">
      <h2 id="feedback-title">¿Cómo te resultó Sale Juntada?</h2>
      {saved && !editing ? (
        <div>
          <p role="status">
            Gracias por tu opinión. Le diste {saved.stars} de 5 estrellas a la
            app.
          </p>
          <button
            type="button"
            className="text-link"
            onClick={() => {
              setStars(saved.stars);
              setComment(saved.comment);
              setEditing(true);
            }}
          >
            Editar mi opinión
          </button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <fieldset disabled={sending}>
            <legend>Tu puntuación</legend>
            <div className="feedback-stars">
              {[1, 2, 3, 4, 5].map((value) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="app-stars"
                    required
                    checked={stars === value}
                    onChange={() => setStars(value)}
                    aria-label={
                      value === 1 ? "1 estrella" : `${value} estrellas`
                    }
                  />
                  <Star
                    aria-hidden="true"
                    fill={value <= stars ? "currentColor" : "none"}
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            Comentario (opcional)
            <textarea
              maxLength={1000}
              rows={3}
              value={comment}
              disabled={sending}
              onChange={(e) => setComment(e.target.value)}
            />
          </label>
          <small>
            Tu opinión llega al equipo de Sale Juntada de forma privada.
          </small>
          {error && <p role="alert">{error}</p>}
          <button
            type="submit"
            className="primary-button"
            disabled={!stars || sending}
          >
            {sending ? "Enviando…" : "Guardar mi opinión"}
          </button>
        </form>
      )}
      <a
        className="feedback-instagram"
        href="https://www.instagram.com/salejuntada.arg/"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Instagram size={19} aria-hidden="true" /> Seguinos en Instagram ·
        @salejuntada.arg
      </a>
    </section>
  );
}
