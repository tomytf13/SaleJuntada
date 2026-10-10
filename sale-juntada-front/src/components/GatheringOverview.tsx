import { Link } from "react-router-dom";
import { ArrowUpRight, ClipboardCheck } from "lucide-react";
import type {
  ChecklistItem,
  ExpenseSettlement,
  Gathering,
  Participant,
} from "../services/gatheringService";
import { summarizeAttendance } from "../hooks/useRsvp";
import {
  gatheringModules,
  isGatheringServiceEnabled,
} from "../utils/gatheringModules";
import { formatMoney } from "../utils/gatheringHelpers";

type Props = {
  gathering: Gathering;
  participant: Participant;
  checklist?: ChecklistItem[];
  checklistError: boolean;
  settlement: ExpenseSettlement | null;
};

export function GatheringServices({
  gathering,
  checklist,
  checklistError,
  settlement,
  compact = false,
}: Omit<Props, "participant"> & { compact?: boolean }) {
  const attendance =
    gathering.rsvpSummary ?? summarizeAttendance(gathering.participants);
  const summary: Record<string, string> = {
    invitados:
      gathering.status === "OPEN"
        ? `${gathering.participants.length} personas en el grupo`
        : `${attendance.going} van · ${attendance.pending} sin responder`,
    fecha:
      gathering.status === "OPEN"
        ? "Encontrar un horario para todos"
        : gathering.status === "CANCELLED"
          ? "Ver el plan anterior"
          : "Fecha confirmada · ver lugar",
    pendientes: checklistError
      ? "No pudimos cargar el resumen"
      : checklist
        ? `${checklist.filter((item) => !item.assignedParticipantId).length} sin responsable · ${checklist.filter((item) => item.isReady).length} resueltas`
        : "Cargando pendientes…",
    alimentacion: `${gathering.participants.filter((p) => p.dietaryPreferences?.length).length} personas con necesidades alimentarias`,
    cuentas: settlement
      ? settlement.allReady
        ? `${settlement.transfers.length} transferencias pendientes`
        : `${formatMoney(settlement.totalCents)} cargados · reparto preliminar`
      : "Abrir gastos y transferencias",
  };
  return (
    <section className="gathering-services" aria-labelledby="services-title">
      <div className="module-heading">
        <div>
          <span className="section-kicker">TODO A MANO</span>
          <h2 id="services-title">Servicios de esta juntada</h2>
        </div>
      </div>
      <div className="gathering-service-grid">
        {gatheringModules
          .filter(
            (module) =>
              (!compact || module.path !== "fecha") &&
              isGatheringServiceEnabled(gathering, module.path),
          )
          .map(({ path, title, detail, icon: Icon }) => (
            <Link
              className="gathering-service-card"
              data-service={path}
              to={`/j/${gathering.slug}/${path}`}
              key={path}
            >
              <div>
                <span className="service-icon">
                  <Icon size={21} aria-hidden="true" />
                </span>
                <ArrowUpRight size={17} aria-hidden="true" />
              </div>
              <h3>{title}</h3>
              <p>{summary[path] ?? detail}</p>
            </Link>
          ))}
      </div>
      {!compact && gathering.disabledServices?.length ? (
        <div className="archived-services">
          <h3>Servicios desactivados</h3>
          <p>El historial sigue disponible en modo lectura.</p>
          {gatheringModules
            .filter(
              (module) => !isGatheringServiceEnabled(gathering, module.path),
            )
            .map((module) => (
              <Link
                key={module.path}
                to={`/j/${gathering.slug}/${module.path}`}
              >
                {module.title} · Ver historial →
              </Link>
            ))}
        </div>
      ) : null}
    </section>
  );
}

export function GatheringPersonalTasks({
  gathering,
  participant,
  checklist,
  checklistError,
  settlement,
}: Props) {
  const base = `/j/${gathering.slug}`;
  const mine =
    checklist?.filter(
      (item) => item.assignedParticipantId === participant.id && !item.isReady,
    ) ?? [];
  const transfers =
    settlement?.transfers.filter(
      (t) => t.fromParticipantId === participant.id,
    ) ?? [];
  return (
    <section className="gathering-personal" aria-labelledby="personal-title">
      <span className="section-kicker">MI PARTE</span>
      <h2 id="personal-title">Lo que te toca a vos</h2>
      {gathering.status === "CANCELLED" ? (
        <p>
          La juntada está cancelada. Podés consultar tus responsabilidades
          anteriores.
        </p>
      ) : null}
      <div className="personal-actions">
        <Link
          to={`${base}/${gathering.status === "OPEN" ? "fecha" : "invitados"}`}
        >
          <strong>
            {gathering.status === "OPEN"
              ? "Mis horarios disponibles"
              : participant.rsvpStatus
                ? "Revisar mi asistencia"
                : "Responder si voy"}
          </strong>
          <span>→</span>
        </Link>
        {isGatheringServiceEnabled(gathering, "pendientes") ? (
          <>
            {checklistError ? (
              <p>
                No pudimos cargar tus pendientes.{" "}
                <Link to={`${base}/pendientes`}>Reintentar en Pendientes</Link>
              </p>
            ) : !checklist ? (
              <p>Cargando tus pendientes…</p>
            ) : mine.length ? (
              mine.map((item) => (
                <Link key={item.id} to={`${base}/pendientes`}>
                  <span>
                    <strong>{item.label}</strong>
                    <small>Asignado a vos · pendiente</small>
                  </span>
                  <span>→</span>
                </Link>
              ))
            ) : (
              <p>No tenés elementos pendientes asignados.</p>
            )}
          </>
        ) : null}
        {isGatheringServiceEnabled(gathering, "cuentas") && transfers.length ? (
          <Link to={`${base}/cuentas/transferencias`}>
            <span>
              <strong>
                {settlement?.allReady
                  ? "Mis transferencias pendientes"
                  : "Mi reparto preliminar"}
              </strong>
              <small>
                {formatMoney(
                  transfers.reduce((sum, item) => sum + item.amountCents, 0),
                )}
                {!settlement?.allReady ? " · esperando el cierre" : ""}
              </small>
            </span>
            <span>→</span>
          </Link>
        ) : null}
        {isGatheringServiceEnabled(gathering, "alimentacion") ? (
          <Link to={`${base}/alimentacion`}>
            <strong>Mis necesidades alimentarias</strong>
            <span>→</span>
          </Link>
        ) : null}
      </div>
    </section>
  );
}

export function GatheringHome(props: Props) {
  const { gathering, participant, checklist } = props;
  const assigned = isGatheringServiceEnabled(gathering, "pendientes")
    ? (checklist?.filter(
        (item) =>
          item.assignedParticipantId === participant.id && !item.isReady,
      ).length ?? 0)
    : 0;
  return (
    <>
      <Link className="gathering-my-part" to={`/j/${gathering.slug}/mi-parte`}>
        <span className="personal-shortcut-copy">
          <span className="personal-shortcut-icon" aria-hidden="true">
            <ClipboardCheck size={22} />
          </span>
          <span>
            <small>MI PARTE</small>
            <strong>
              {assigned
                ? `${assigned} ${assigned === 1 ? "pendiente a tu cargo" : "pendientes a tu cargo"}`
                : "Mi asistencia y responsabilidades"}
            </strong>
          </span>
        </span>
        <ArrowUpRight size={22} aria-hidden="true" />
      </Link>
      <GatheringServices {...props} compact />
    </>
  );
}
