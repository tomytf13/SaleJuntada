import { useId, useState } from "react";
import { Instagram } from "lucide-react";
import "./ParticipantProfileEditor.css";
import { gatheringService, type Participant } from "../services/gatheringService";

export function ParticipantInstagramEditor({ gatheringId, participant, token, onSaved }: {
  gatheringId: string; participant: Participant; token: string;
  onSaved(username: string | null): void;
}) {
  const id = useId();
  const [username, setUsername] = useState(participant.instagramUsername ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  return <form className="participant-profile-editor instagram-editor" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError(""); setSaved(false);
    try {
      const result = await gatheringService.updateInstagram(gatheringId, participant.id, token, username);
      onSaved(result.instagramUsername); setSaved(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No pudimos guardar tu Instagram."); }
    finally { setBusy(false); }
  }}>
    <h3><Instagram size={20} aria-hidden="true" /> Tu Instagram</h3>
    <label htmlFor={id}>Usuario de Instagram (opcional)</label>
    <input id={id} value={username} maxLength={31} placeholder="@tu.usuario" autoCapitalize="none" spellCheck={false} disabled={busy} aria-describedby={`${id}-help`} onChange={event => { setUsername(event.target.value); setSaved(false); }} />
    <p id={`${id}-help`}>Solo lo ven quienes se unieron a esta juntada. Ingresá tu usuario, sin el enlace. Dejalo vacío para quitarlo.</p>
    {error ? <p role="alert" className="form-error">{error}</p> : null}
    {saved ? <p role="status">Tu Instagram quedó actualizado.</p> : null}
    <button className="primary-button" disabled={busy || username === (participant.instagramUsername ?? "")}>{busy ? "Guardando…" : "Guardar Instagram"}</button>
  </form>;
}
