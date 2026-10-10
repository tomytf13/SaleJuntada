import { FormEvent, useMemo, useState } from "react";
import type {
  Gathering,
  UpdateGatheringInput,
} from "../services/gatheringService";
import {
  calendarDate,
  clockTime,
  shiftDay,
  scheduleInstant,
} from "../utils/schedule";
import { AnimatedDialog } from "./AnimatedDialog";

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

function initialValues(gathering: Gathering) {
  const fixed = gathering.status === "CONFIRMED";
  const start =
    fixed && gathering.finalizedStart
      ? gathering.finalizedStart
      : gathering.windowStart;
  const end =
    fixed && gathering.finalizedEnd
      ? gathering.finalizedEnd
      : gathering.windowEnd;
  return {
    fixed,
    title: gathering.title,
    location: gathering.finalizedLocation ?? gathering.locationHint ?? "",
    from: calendarDate(start, gathering.timeZone),
    to: fixed
      ? calendarDate(end, gathering.timeZone)
      : shiftDay(
          calendarDate(end, gathering.timeZone),
          (gathering.dailyEndMinutes ?? 1440) >= 1440 ? -1 : 0,
        ),
    startTime: fixed
      ? clockTime(start, gathering.timeZone)
      : timeFromMinutes(gathering.dailyStartMinutes ?? 780),
    endTime: fixed
      ? clockTime(end, gathering.timeZone)
      : timeFromMinutes(gathering.dailyEndMinutes ?? 1440),
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
        fixed: false,
        title: "",
        location: "",
        from: "",
        to: "",
        startTime: "19:00",
        endTime: "02:00",
        duration: 180,
      };
  const [fixed, setFixed] = useState(values.fixed);
  const [title, setTitle] = useState(values.title);
  const [location, setLocation] = useState(values.location);
  const [from, setFrom] = useState(values.from);
  const [to, setTo] = useState(values.to);
  const [startTime, setStartTime] = useState(values.startTime);
  const [endTime, setEndTime] = useState(values.endTime);
  const [duration, setDuration] = useState(values.duration);

  const effectiveTo =
    fixed && from && to === from && endTime <= startTime ? shiftDay(to, 1) : to;
  const preview = useMemo(() => {
    const start = minutesFromTime(startTime);
    const rawEnd = minutesFromTime(endTime);
    const dayDifference =
      from && effectiveTo
        ? (new Date(`${effectiveTo}T00:00:00Z`).getTime() -
            new Date(`${from}T00:00:00Z`).getTime()) /
          86400000
        : 0;
    const end = fixed
      ? rawEnd + dayDifference * 1440
      : rawEnd <= start
        ? rawEnd + 1440
        : rawEnd;
    return {
      start,
      end,
      valid: Boolean(
        from &&
        to &&
        from <= effectiveTo &&
        (fixed
          ? end - start >= 30 && end - start <= 1440
          : end - start >= duration),
      ),
      overnight: end >= 1440,
    };
  }, [duration, endTime, from, startTime, to, fixed, effectiveTo]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!gathering || !preview.valid) return;
    const input: UpdateGatheringInput = {
      fixedSchedule: fixed,
      title: title.trim(),
      locationHint: location.trim(),
      windowStart:
        fixed || from !== values.from || startTime !== values.startTime
          ? scheduleInstant(
              from,
              preview.start,
              gathering.timeZone,
            ).toISOString()
          : gathering.windowStart,
      windowEnd:
        fixed ||
        to !== values.to ||
        endTime !== values.endTime ||
        preview.overnight !== (gathering.dailyEndMinutes ?? 1440) >= 1440
          ? scheduleInstant(
              fixed ? from : to,
              preview.end,
              gathering.timeZone,
            ).toISOString()
          : gathering.windowEnd,
      durationMinutes: fixed ? preview.end - preview.start : duration,
      dailyStartMinutes: preview.start,
      dailyEndMinutes: preview.end,
      slotStepMinutes: gathering.slotStepMinutes ?? 60,
    };
    const flexibleChanged =
      fixed !== values.fixed ||
      input.windowStart !== new Date(gathering.windowStart).toISOString() ||
      input.windowEnd !== new Date(gathering.windowEnd).toISOString() ||
      input.durationMinutes !== gathering.durationMinutes ||
      input.dailyStartMinutes !== (gathering.dailyStartMinutes ?? 780) ||
      input.dailyEndMinutes !== (gathering.dailyEndMinutes ?? 1440);
    const scheduleChanged = fixed
      ? !values.fixed ||
        input.windowStart !== gathering.finalizedStart ||
        input.windowEnd !== gathering.finalizedEnd
      : flexibleChanged;
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
        <label>
          Tipo de horario
          <select
            value={fixed ? "fixed" : "flexible"}
            onChange={(event) => {
              const nextFixed = event.target.value === "fixed";
              if (nextFixed !== fixed && preview.overnight)
                setTo(
                  shiftDay(nextFixed ? to : effectiveTo, nextFixed ? 1 : -1),
                );
              setFixed(nextFixed);
            }}
          >
            <option value="fixed">Horario fijo · confirmar asistencia</option>
            <option value="flexible">
              Buscar horario · consultar disponibilidad
            </option>
          </select>
        </label>
        <div className="form-row">
          <label>
            {fixed ? "Día de inicio" : "Primer día posible"}
            <input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                if (fixed || to < event.target.value) setTo(event.target.value);
              }}
              required
            />
          </label>
          <label>
            {fixed ? "Día de finalización" : "Último día posible de inicio"}
            <input
              type="date"
              min={from}
              value={effectiveTo}
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
          <small className="overnight-note">
            🌙 Termina el{" "}
            {shiftDay(fixed ? from : to, 1)
              .split("-")
              .reverse()
              .join("/")}{" "}
            a las {endTime} (día siguiente).
          </small>
        ) : null}
        {fixed ? (
          <p role="status">
            Duración total: {preview.end - preview.start} minutos (
            {(preview.end - preview.start) / 60} horas).
          </p>
        ) : (
          <label>
            Duración de cada opción
            <select
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value))}
            >
              <option value={60}>1 hora</option>
              <option value={120}>2 horas</option>
              <option value={180}>3 horas</option>
              <option value={240}>4 horas</option>
              <option value={300}>5 horas</option>
              <option value={360}>6 horas</option>
              <option value={420}>7 horas</option>
              <option value={480}>8 horas</option>
              <option value={720}>12 horas</option>
            </select>
          </label>
        )}
        {!fixed ? (
          <small>
            Las fechas indican los días en que puede empezar. Cada opción
            muestra su inicio y fin.
          </small>
        ) : null}
        {!preview.valid ? (
          <small className="form-error" role="alert">
            Revisá el rango: el fin debe ser posterior al inicio. El horario
            fijo admite entre 30 minutos y 24 horas.
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
