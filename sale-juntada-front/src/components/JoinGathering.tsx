import type { FormEvent } from "react";
import { PhoneContactField } from "./PhoneContactField";

type Props = {
  open: boolean;
  defaultName?: string;
  isSubmitting: boolean;
  warning: string;
  error: string;
  hasDate: boolean;
  onOpen(): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  onAccount(): void;
};

export function JoinGathering({
  open,
  defaultName,
  isSubmitting,
  warning,
  error,
  hasDate,
  onOpen,
  onSubmit,
  onAccount,
}: Props) {
  return (
    <section className="join-gathering" aria-labelledby="join-title">
      <h2 id="join-title">{hasDate ? "¿Venís?" : "¿Cuándo podés?"}</h2>
      <p>{open ? "Así va a aparecer tu nombre en la juntada." : hasDate
        ? "Sumate para avisarle al grupo si vas."
        : "Sumate para marcar los horarios que te quedan bien."}</p>
      {open ? (
        <form onSubmit={onSubmit}>
          <label htmlFor="participant-name">Tu nombre</label>
          <input
            id="participant-name"
            name="participantName"
            autoComplete="name"
            defaultValue={defaultName}
            placeholder="Ej. Sofi"
            minLength={2}
            maxLength={80}
            required
            disabled={isSubmitting}
          />
          <PhoneContactField disabled={isSubmitting} />
          {warning ? (
            <div className="duplicate-warning" role="alert">
              <strong>Ya hay alguien con ese nombre</strong>
              <p>
                Si sos vos, recuperá tu acceso con tu cuenta. Si es otra
                persona, podés entrar igual.
              </p>
            </div>
          ) : null}
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            className="primary-button"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Sumándote…"
              : warning
                ? "Entrar igual"
                : hasDate
                  ? "Entrar y responder"
                  : "Entrar y marcar horarios"}
          </button>
          <button className="text-link" type="button" onClick={onAccount}>
            Ver mi cuenta
          </button>
        </form>
      ) : (
        <button className="primary-button" type="button" onClick={onOpen}>
          Aceptar invitación →
        </button>
      )}
    </section>
  );
}
