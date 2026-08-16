import { useState, type FormEvent } from "react";

const aliasPattern = /^[A-Za-z0-9.-]{6,20}$/;

export function PaymentAliasEditor({
  paymentAlias,
  persistsToProfile,
  isSaving,
  onSave,
}: {
  paymentAlias: string | null;
  persistsToProfile: boolean;
  isSaving: boolean;
  onSave(paymentAlias: string): Promise<void>;
}) {
  const [value, setValue] = useState(paymentAlias ?? "");
  const [error, setError] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = value.trim().toLowerCase();
    if (normalized && !aliasPattern.test(normalized)) {
      setError(
        "Usá entre 6 y 20 caracteres: letras, números, punto o guion.",
      );
      return;
    }
    setError("");
    void onSave(normalized);
  };

  return (
    <form className="payment-alias-card" onSubmit={submit} noValidate>
      <div className="payment-alias-icon" aria-hidden="true">
        $
      </div>
      <div className="payment-alias-copy">
        <label htmlFor="payment-alias">Tu alias para transferencias</label>
        <p>
          {persistsToProfile
            ? "Lo vamos a recordar para tus próximas juntadas."
            : "Queda disponible para quienes deban transferirte en esta juntada."}
        </p>
        <div className="payment-alias-controls">
          <input
            id="payment-alias"
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            minLength={6}
            maxLength={20}
            pattern="[A-Za-z0-9.-]{6,20}"
            placeholder="Ej. mate.asado.2026"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              if (error) setError("");
            }}
            aria-describedby="payment-alias-help"
          />
          <button type="submit" disabled={isSaving}>
            {isSaving ? "Guardando…" : "Guardar alias"}
          </button>
          {paymentAlias ? (
            <button
              className="payment-alias-remove"
              type="button"
              disabled={isSaving}
              onClick={() => {
                setValue("");
                setError("");
                void onSave("");
              }}
            >
              Quitar
            </button>
          ) : null}
        </div>
        <small id="payment-alias-help">
          Compartimos el alias únicamente con integrantes que deban pagarte.
        </small>
        {error ? (
          <small className="form-error" role="alert">
            {error}
          </small>
        ) : null}
      </div>
    </form>
  );
}
