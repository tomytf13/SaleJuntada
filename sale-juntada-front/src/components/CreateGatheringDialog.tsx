import { AccountDialog } from "./AccountDialog";
import { FormEvent, Suspense, lazy, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  gatheringService,
  type Gathering,
} from "../services/gatheringService";
import type { SelectedLocation } from "./LocationPicker";
import { AnimatedDialog } from "./AnimatedDialog";
import { SparkIcon } from "./SparkIcon";
import { useAuth } from "../auth/useAuth";
import {
  avatarPresets,
  dateAtMinutes,
  dateDaysFromNow,
  dateInputValue,
  makeAvatarThumbnail,
  minutesFromTime,
  storeParticipantSession,
} from "../utils/gatheringHelpers";

const LocationPicker = lazy(() =>
  import("./LocationPicker").then((module) => ({
    default: module.LocationPicker,
  })),
);

const timeWindowPresets = [
  { label: "Almuerzo", icon: "☀️", start: "11:00", end: "17:00" },
  { label: "Tarde", icon: "🧉", start: "15:00", end: "22:00" },
  { label: "Noche", icon: "🌙", start: "19:00", end: "02:00" },
];

export type CreateGatheringPrefill = {
  templateGatheringId: string;
  title: string;
  from: string;
  to: string;
  startTime: string;
  endTime: string;
  duration: number;
  location: SelectedLocation | null;
};

type CreateGatheringDialogProps = {
  open: boolean;
  onClose: () => void;
  prefill?: CreateGatheringPrefill | null;
  onCreated?: (gathering: Gathering) => void;
};

/**
 * Formulario de creación existente, extraído de `App.tsx` para que tanto
 * `LandingPage` como el flujo de "duplicar juntada" de `GatheringPage`
 * puedan dispararlo sin depender uno del otro. Mismos campos y misma
 * validación que antes de P1.3 — el contrato `startsAt` en dos pasos llega
 * en P1.6.
 */
export function CreateGatheringDialog({
  open,
  onClose,
  prefill,
  onCreated,
}: CreateGatheringDialogProps) {
  const navigate = useNavigate();
  const { user, accessToken } = useAuth();
  const authName = String(
    user?.user_metadata.full_name ??
      user?.user_metadata.name ??
      user?.email?.split("@")[0] ??
      "Tu cuenta",
  );
  const authAvatarValue =
    user?.user_metadata.avatar_url ?? user?.user_metadata.picture;
  const authAvatarUrl =
    typeof authAvatarValue === "string" ? authAvatarValue : null;

  const [createTitle, setCreateTitle] = useState(
    prefill?.title ?? "Asado con los pibes",
  );
  const [createOrganizerName, setCreateOrganizerName] = useState(
    user ? authName : "",
  );
  const [createFrom, setCreateFrom] = useState(
    () => prefill?.from ?? dateDaysFromNow(1),
  );
  const [createTo, setCreateTo] = useState(
    () => prefill?.to ?? dateDaysFromNow(3),
  );
  const [createStartTime, setCreateStartTime] = useState(
    prefill?.startTime ?? "19:00",
  );
  const [createEndTime, setCreateEndTime] = useState(
    prefill?.endTime ?? "02:00",
  );
  const [createDuration, setCreateDuration] = useState(
    prefill?.duration ?? 180,
  );
  const [selectedLocation, setSelectedLocation] =
    useState<SelectedLocation | null>(prefill?.location ?? null);
  const [selectedAvatar, setSelectedAvatar] = useState(
    authAvatarUrl ?? "emoji:🦆",
  );
  const [isPreparingAvatar, setIsPreparingAvatar] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");

  const templateGatheringId = prefill?.templateGatheringId ?? null;

  const createSchedulePreview = useMemo(() => {
    const firstDay = new Date(`${createFrom}T00:00:00`);
    const lastDay = new Date(`${createTo}T00:00:00`);
    const dayCount = Math.max(
      1,
      Math.round((lastDay.getTime() - firstDay.getTime()) / 86_400_000) + 1,
    );
    const startMinutes = minutesFromTime(createStartTime);
    const rawEndMinutes = minutesFromTime(createEndTime);
    const overnight = rawEndMinutes <= startMinutes;
    const endMinutes = overnight ? rawEndMinutes + 1440 : rawEndMinutes;
    const optionsPerDay = Math.max(
      0,
      Math.floor((endMinutes - startMinutes - createDuration) / 60) + 1,
    );

    return {
      dayCount,
      overnight,
      optionsPerDay,
      totalOptions: dayCount * optionsPerDay,
    };
  }, [createDuration, createEndTime, createFrom, createStartTime, createTo]);

  const createEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    const place = selectedLocation?.label ?? "";
    const organizerName = String(form.get("organizerName") || "").trim();
    const from = String(form.get("from") || "");
    const to = String(form.get("to") || "");
    const startMinutes = minutesFromTime(createStartTime);
    const rawEndMinutes = minutesFromTime(createEndTime);
    const endMinutes =
      rawEndMinutes <= startMinutes ? rawEndMinutes + 1440 : rawEndMinutes;

    if (!from || !to || to < from) {
      setApiError("Elegí un rango de fechas válido.");
      return;
    }
    if (endMinutes - startMinutes < createDuration) {
      setApiError("La franja debe alcanzar para la duración de la juntada.");
      return;
    }

    setIsSubmitting(true);
    setApiError("");
    try {
      const gathering = await gatheringService.create(
        {
          templateGatheringId: templateGatheringId ?? undefined,
          title,
          organizerName,
          organizerAvatarUrl: selectedAvatar,
          locationHint: place || undefined,
          locationLatitude: selectedLocation?.latitude,
          locationLongitude: selectedLocation?.longitude,
          windowStart: dateAtMinutes(from, startMinutes).toISOString(),
          windowEnd: dateAtMinutes(to, endMinutes).toISOString(),
          durationMinutes: createDuration,
          dailyStartMinutes: startMinutes,
          dailyEndMinutes: endMinutes,
          slotStepMinutes: 60,
          // Los horarios se interpretan en la zona de quien organiza, así
          // todo el grupo lee la misma hora de pared.
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        accessToken,
      );
      const organizer = gathering.participants.find(
        (participant) => participant.isOrganizer,
      );
      if (organizer?.responseToken) {
        storeParticipantSession(
          gathering.slug,
          organizer.id,
          organizer.responseToken,
        );
      }
      onCreated?.(gathering);
      onClose();
      navigate(`/j/${gathering.slug}${gathering.status === "OPEN" ? "/fecha" : ""}`);
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : "No pudimos crear la juntada.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user || !accessToken) return <AccountDialog open={open} onClose={onClose} />;

  return (
    <AnimatedDialog
      open={open}
      onClose={onClose}
      panelClassName="create-sheet"
      label="Crear una juntada"
      as="form"
      onSubmit={createEvent}
    >
      <button
        type="button"
        className="close-button"
        onClick={onClose}
        aria-label="Cerrar"
      >
        ×
      </button>
      <span className="eyebrow">
        <SparkIcon />{" "}
        {templateGatheringId ? "Duplicar juntada" : "Nueva juntada"}
      </span>
      <h2 id="create-title">¿Qué plan tienen?</h2>
      <p>
        {templateGatheringId
          ? "Copiamos el lugar, la configuración y las cantidades. Los invitados, responsables y gastos empiezan de cero."
          : "Con lo básico alcanza. Después el grupo completa el resto."}
      </p>
      <label>
        Nombre de la juntada
        <input
          name="title"
          value={createTitle}
          onChange={(event) => setCreateTitle(event.target.value)}
          placeholder="Ej. Asado, birras, fulbito..."
          required
        />
      </label>
      <label>
        Tu nombre
        <input
          name="organizerName"
          value={createOrganizerName}
          onChange={(event) => setCreateOrganizerName(event.target.value)}
          placeholder="Ej. Tomás"
          minLength={2}
          required
        />
      </label>
      <fieldset className="avatar-picker">
        <legend>Elegí tu personaje</legend>
        <div className="avatar-options">
          {avatarPresets.map((emoji) => {
            const value = `emoji:${emoji}`;
            return (
              <button
                type="button"
                className={selectedAvatar === value ? "selected" : ""}
                aria-label={`Usar ${emoji} como avatar`}
                aria-pressed={selectedAvatar === value}
                onClick={() => setSelectedAvatar(value)}
                key={emoji}
              >
                {emoji}
              </button>
            );
          })}
          <label className="photo-avatar-option">
            {selectedAvatar.startsWith("data:") ? (
              <img src={selectedAvatar} alt="Tu foto elegida" />
            ) : (
              <span>📷</span>
            )}
            <small>{isPreparingAvatar ? "Preparando…" : "Tu foto"}</small>
            <input
              type="file"
              accept="image/*"
              disabled={isPreparingAvatar}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setIsPreparingAvatar(true);
                setApiError("");
                try {
                  setSelectedAvatar(await makeAvatarThumbnail(file));
                } catch (error) {
                  setApiError(
                    error instanceof Error
                      ? error.message
                      : "No pudimos preparar esa foto.",
                  );
                } finally {
                  setIsPreparingAvatar(false);
                }
              }}
            />
          </label>
        </div>
        <small>La foto se recorta y comprime antes de guardarse.</small>
      </fieldset>
      <section className="schedule-builder location-builder">
        <div className="schedule-heading">
          <div>
            <strong>¿Dónde sería?</strong>
            <small>Buscá el lugar y ajustá el pin si hace falta.</small>
          </div>
          <span>📍</span>
        </div>
        <Suspense
          fallback={
            <div className="map-loading" role="status">
              Preparando el mapa…
            </div>
          }
        >
          <LocationPicker value={selectedLocation} onChange={setSelectedLocation} />
        </Suspense>
      </section>
      <section className="schedule-builder">
        <div className="schedule-heading">
          <div>
            <strong>¿Qué días buscamos?</strong>
            <small>Elegí el período que querés consultar.</small>
          </div>
          <span>1</span>
        </div>
        <div className="form-row">
          <label>
            Desde
            <input
              name="from"
              type="date"
              min={dateInputValue(new Date())}
              value={createFrom}
              onChange={(event) => {
                const value = event.target.value;
                setCreateFrom(value);
                if (createTo < value) setCreateTo(value);
              }}
              required
            />
          </label>
          <label>
            Hasta
            <input
              name="to"
              type="date"
              min={createFrom}
              value={createTo}
              onChange={(event) => setCreateTo(event.target.value)}
              required
            />
          </label>
        </div>
      </section>
      <section className="schedule-builder">
        <div className="schedule-heading">
          <div>
            <strong>¿En qué horario?</strong>
            <small>No mostraremos opciones fuera de esta franja.</small>
          </div>
          <span>2</span>
        </div>
        <div className="time-presets" aria-label="Franjas sugeridas">
          {timeWindowPresets.map((preset) => {
            const selected =
              createStartTime === preset.start && createEndTime === preset.end;
            return (
              <button
                type="button"
                className={selected ? "selected" : ""}
                aria-pressed={selected}
                onClick={() => {
                  setCreateStartTime(preset.start);
                  setCreateEndTime(preset.end);
                }}
                key={preset.label}
              >
                <span>{preset.icon}</span>
                {preset.label}
              </button>
            );
          })}
        </div>
        <div className="form-row time-range-row">
          <label>
            Desde las
            <input
              type="time"
              value={createStartTime}
              onChange={(event) => setCreateStartTime(event.target.value)}
              required
            />
          </label>
          <label>
            Hasta las
            <input
              type="time"
              value={createEndTime}
              onChange={(event) => setCreateEndTime(event.target.value)}
              required
            />
          </label>
        </div>
        {createSchedulePreview.overnight && (
          <small className="overnight-note">🌙 Termina al día siguiente.</small>
        )}
        <label>
          ¿Cuánto debería durar?
          <select
            value={createDuration}
            onChange={(event) => setCreateDuration(Number(event.target.value))}
          >
            <option value={60}>1 hora</option>
            <option value={120}>2 horas</option>
            <option value={180}>3 horas</option>
            <option value={240}>4 horas</option>
            <option value={300}>5 horas</option>
          </select>
        </label>
      </section>
      <div
        className={`schedule-preview ${
          createSchedulePreview.totalOptions === 0 ? "invalid" : ""
        }`}
      >
        <span aria-hidden="true">✨</span>
        <div>
          <strong>
            {createSchedulePreview.totalOptions > 0
              ? `${createSchedulePreview.totalOptions} horarios posibles`
              : "La franja es demasiado corta"}
          </strong>
          <small>
            {createSchedulePreview.dayCount} días · opciones cada 1 hora ·
            duración de {createDuration / 60} h
          </small>
        </div>
      </div>
      {apiError && (
        <small className="form-error" role="alert">
          {apiError}
        </small>
      )}
      <button
        className="primary-button full"
        type="submit"
        disabled={
          isSubmitting || isPreparingAvatar || createSchedulePreview.totalOptions === 0
        }
      >
        {isSubmitting
          ? "Creando…"
          : templateGatheringId
            ? "Crear copia y revisar"
            : "Crear y elegir horarios"}{" "}
        <span>→</span>
      </button>
      <small className="privacy-note">
        Nadie necesita registrarse para responder.
      </small>
    </AnimatedDialog>
  );
}
