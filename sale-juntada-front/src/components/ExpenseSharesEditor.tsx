import { useState, type FormEvent } from "react";

type Props = {
  members: { participantId: string; name: string }[];
  shares: Record<string, number>;
  isOrganizer: boolean;
  needsConfirmation: boolean;
  onSave(shares: Record<string, number>): Promise<void>;
};

export function ExpenseSharesEditor({
  members,
  shares,
  isOrganizer,
  needsConfirmation,
  onSave,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const next = Object.fromEntries(
      members.map(({ participantId }) => [
        participantId,
        Number(values.get(participantId)),
      ]),
    );
    setSaving(true);
    setError("");
    try {
      await onSave(next);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No pudimos guardar el reparto.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <details
      className="expense-entry-card"
      open={needsConfirmation || undefined}
    >
      <summary>¿Entre quiénes dividimos?</summary>
      <form className="expense-form" onSubmit={submit}>
        <p>
          Una parte por persona. Usá cero para excluir a alguien. Si adelantó
          plata, recupera lo que pagó.
        </p>
        {members.map(({ participantId, name }) => (
          <label key={participantId}>
            {name}
            <input
              type="number"
              min="0"
              max="100"
              required
              name={participantId}
              defaultValue={shares[participantId] ?? 0}
              disabled={!isOrganizer || saving}
            />
          </label>
        ))}
        {error && <p role="alert">{error}</p>}
        {isOrganizer && (
          <button type="submit" disabled={saving}>
            {saving ? "Guardando…" : "Confirmar reparto"}
          </button>
        )}
      </form>
    </details>
  );
}
