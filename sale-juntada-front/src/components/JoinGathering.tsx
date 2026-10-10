import type { FormEvent } from "react";

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
      <h2 id="join-title">Sumate a la juntada</h2>
      <p>Sumate con tu nombre. También podés dejar un teléfono de contacto.</p>
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
          <label htmlFor="participant-phone">Teléfono de contacto (opcional)</label>
          <input
            id="participant-phone"
            name="participantPhone"
            type="tel"
            autoComplete="tel"
            placeholder="+54 9 381 123 4567"
            maxLength={32}
            aria-describedby="participant-phone-help"
            disabled={isSubmitting}
          />
          <p id="participant-phone-help">
            Incluí el código de país. Lo guardamos como contacto para futuras
            funciones de WhatsApp; no se muestra a otros invitados ni se envían
            mensajes ahora. El número no se verifica por SMS.
          </p>
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
            Recuperar mi acceso con una cuenta
          </button>
        </form>
      ) : (
        <button className="primary-button" type="button" onClick={onOpen}>
          Sumarme →
        </button>
      )}
    </section>
  );
}
