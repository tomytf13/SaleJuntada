import { useState } from "react";
import { Camera, Check } from "lucide-react";
import { gatheringService, type Participant } from "../services/gatheringService";
import { avatarPresets, makeAvatarThumbnail } from "../utils/gatheringHelpers";
import { ParticipantAvatar } from "./ParticipantAvatar";
import "./ParticipantProfileEditor.css";

export function ParticipantProfileEditor({ gatheringId, participant, token, googlePhoto, onSaved }: {
  gatheringId: string;
  participant: Participant;
  token: string;
  googlePhoto?: string | null;
  onSaved(avatarUrl: string): void;
}) {
  const [selected, setSelected] = useState(participant.avatarUrl ?? "emoji:🦆");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const choose = (value: string) => { setSelected(value); setSaved(false); setError(""); };
  const save = async () => {
    setBusy(true); setError(""); setSaved(false);
    try {
      const result = await gatheringService.updateAvatar(gatheringId, participant.id, token, selected);
      onSaved(result.avatarUrl ?? selected);
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No pudimos guardar tu avatar. Probá otra vez.");
    } finally { setBusy(false); }
  };
  return <section className="participant-profile-editor" aria-label="Tu perfil en esta juntada">
    <div className="profile-avatar-preview"><ParticipantAvatar name={participant.name} avatarUrl={selected} /><div><h3>Tu perfil en esta juntada</h3><p>{participant.name} · Elegí cómo te ve el grupo.</p></div></div>
    <fieldset className="avatar-picker" disabled={busy}>
      <legend>Elegí tu ícono</legend>
      <div className="avatar-options">
        {[...avatarPresets, "🥳", "🎂", "⚽", "🎮", "🎸", "🌸"].map(emoji => <button key={emoji} type="button" aria-label={`Usar ${emoji} como avatar`} aria-pressed={selected === `emoji:${emoji}`} className={selected === `emoji:${emoji}` ? "selected" : ""} onClick={() => choose(`emoji:${emoji}`)}>{emoji}</button>)}
      </div>
      <label className="profile-photo-upload"><Camera size={18} aria-hidden="true" />Subir una imagen
        <input type="file" accept="image/*" onChange={async event => {
          const file = event.target.files?.[0]; event.target.value = "";
          if (!file) return;
          setBusy(true); setError(""); setSaved(false);
          try { choose(await makeAvatarThumbnail(file)); }
          catch (caught) { setError(caught instanceof Error ? caught.message : "No pudimos abrir esa imagen."); }
          finally { setBusy(false); }
        }} />
      </label>
      <small>Hasta 12 MB. La imagen se recorta al centro y se comprime antes de guardarse.</small>
      {googlePhoto ? <button className="text-link" type="button" onClick={() => choose(googlePhoto)}>Usar mi foto de Google</button> : null}
    </fieldset>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    {saved ? <p className="profile-avatar-saved" role="status"><Check size={16} aria-hidden="true" />Tu avatar quedó guardado.</p> : null}
    <button className="primary-button" type="button" disabled={busy || selected === participant.avatarUrl} onClick={() => void save()}>{busy ? "Preparando…" : "Guardar avatar"}</button>
  </section>;
}
