import { FormEvent, useMemo, useState } from "react";
import type {
  Gathering,
  UpdateGatheringInput,
} from "../services/gatheringService";
import { AnimatedDialog } from "./AnimatedDialog";

function dateInputValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function timeFromMinutes(value: number) {
  const normalized = value % 1440;
  const hours = Math.floor(normalized / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (normalized % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function dateAtMinutes(date: string, minutes: number) {
  const value = new Date(`${date}T00:00:00`);
  value.setMinutes(minutes);
  return value;
}

function initialValues(gathering: Gathering) {
  const visibleEnd = new Date(gathering.windowEnd);
  if ((gathering.dailyEndMinutes ?? 1440) >= 1440) {
    visibleEnd.setDate(visibleEnd.getDate() - 1);
  }
  return {
    title: gathering.title,
    location: gathering.locationHint ?? "",
    from: dateInputValue(new Date(gathering.windowStart)),
    to: dateInputValue(visibleEnd),
    startTime: timeFromMinutes(gathering.dailyStartMinutes ?? 780),
    endTime: timeFromMinutes(gathering.dailyEndMinutes ?? 1440),
    duration: gathering.durationMinutes,
  };
}

export function GatheringManagementDialog({
  ...props
}: {
  open: boolean;
  gathering: Gathering | null;
  isSaving: boolean;
  onClose(): void;
  onSave(input: UpdateGatheringInput): Promise<void>;
  onCancelGathering(): Promise<void>;
}) {
  return (
    <GatheringManagementForm
      key={`${props.gathering?.id ?? "empty"}:${props.open ? "open" : "closed"}`}
      {...props}
    />
  );
}

function GatheringManagementForm({
  open,
  gathering,
  isSaving,
  onClose,
  onSave,
  onCancelGathering,
}: {
  open: boolean;
  gathering: Gathering | null;
  isSaving: boolean;
  onClose(): void;
  onSave(input: UpdateGatheringInput): Promise<void>;
  onCancelGathering(): Promise<void>;
}) {
  const values = gathering
    ? initialValues(gathering)
    : {
        title: "",
        location: "",
        from: "",
        to: "",
        startTime: "19:00",
        endTime: "02:00",
        duration: 180,
      };
  const [title, setTitle] = useState(values.title);
  const [location, setLocation] = useState(values.location);
  const [from, setFrom] = useState(values.from);
  const [to, setTo] = useState(values.to);
  const [startTime, setStartTime] = useState(values.startTime);
  const [endTime, setEndTime] = useState(values.endTime);
  const [duration, setDuration] = useState(values.duration);

  const preview = useMemo(() => {
    const start = minutesFromTime(startTime);
    const rawEnd = minutesFromTime(endTime);
    const end = rawEnd <= start ? rawEnd + 1440 : rawEnd;
    return {
      start,
      end,
      valid: Boolean(from && to && from <= to && end - start >= duration),
      overnight: end >= 1440,
    };
  }, [duration, endTime, from, startTime, to]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!gathering || !preview.valid) return;
    const input: UpdateGatheringInput = {
      title: title.trim(),
      locationHint: location.trim(),
      windowStart: dateAtMinutes(from, preview.start).toISOString(),
      windowEnd: dateAtMinutes(to, preview.end).toISOString(),
      durationMinutes: duration,
      dailyStartMinutes: preview.start,
      dailyEndMinutes: preview.end,
      slotStepMinutes: gathering.slotStepMinutes ?? 60,
    };
    const scheduleChanged =
      input.windowStart !== new Date(gathering.windowStart).toISOString() ||
      input.windowEnd !== new Date(gathering.windowEnd).toISOString() ||
      input.durationMinutes !== gathering.durationMinutes ||
      input.dailyStartMinutes !== (gathering.dailyStartMinutes ?? 780) ||
      input.dailyEndMinutes !== (gathering.dailyEndMinutes ?? 1440);
    if (
      scheduleChanged &&
      !window.confirm(
        "Cambiar fechas u horarios borrará las disponibilidades actuales para que el grupo vuelva a responder. ¿Continuar?",
      )
    ) {
      return;
    }
    await onSave(input);
  };

  const cancelGathering = async () => {
    if (
      !window.confirm(
        "La juntada quedará marcada como cancelada para todo el grupo. ¿Continuar?",
      )
    ) {
      return;
    }
    await onCancelGathering();
  };

  return (
    <AnimatedDialog
      open={open && Boolean(gathering)}
      onClose={onClose}
      panelClassName="create-sheet manage-gathering-sheet"
      label="Administrar juntada"
      as="form"
      onSubmit={submit}
    >
      <button
        type="button"
        className="close-button"
        onClick={onClose}
        aria-label="Cerrar"
      >
        ×
      </button>
      <span className="eyebrow">Configuración del organizador</span>
      <h2>Administrar juntada</h2>
      <p>Actualizá el plan o cancelalo para que todo el grupo vea el cambio.</p>

      <label>
        Nombre de la juntada
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          minLength={3}
          maxLength={120}
          required
        />
      </label>
      <label>
        Lugar
        <input
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          maxLength={180}
          placeholder="Lugar a definir"
        />
      </label>

      <section className="schedule-builder">
        <div className="schedule-heading">
          <div>
            <strong>Fechas y horarios</strong>
            <small>Si cambian, el grupo deberá volver a responder.</small>
          </div>
          <span>↻</span>
        </div>
        <div className="form-row">
          <label>
            Desde
            <input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                if (to < event.target.value) setTo(event.target.value);
              }}
              required
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              min={from}
              value={to}
              onChange={(event) => setTo(event.target.value)}
              required
            />
          </label>
        </div>
        <div className="form-row time-range-row">
          <label>
            Desde las
            <input
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              required
            />
          </label>
          <label>
            Hasta las
            <input
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              required
            />
          </label>
        </div>
        {preview.overnight ? (
          <small className="overnight-note">🌙 Termina al día siguiente.</small>
        ) : null}
        <label>
          Duración
          <select
            value={duration}
            onChange={(event) => setDuration(Number(event.target.value))}
          >
            <option value={60}>1 hora</option>
            <option value={120}>2 horas</option>
            <option value={180}>3 horas</option>
            <option value={240}>4 horas</option>
            <option value={300}>5 horas</option>
          </select>
        </label>
        {!preview.valid ? (
          <small className="form-error" role="alert">
            Revisá el rango: debe alcanzar para la duración elegida.
          </small>
        ) : null}
      </section>

      <button
        className="primary-button full"
        type="submit"
        disabled={isSaving || !preview.valid}
      >
        {isSaving ? "Guardando…" : "Guardar cambios"}
      </button>
      <button
        className="danger-zone-button"
        type="button"
        disabled={isSaving}
        onClick={() => void cancelGathering()}
      >
        Cancelar esta juntada
      </button>
    </AnimatedDialog>
  );
}
