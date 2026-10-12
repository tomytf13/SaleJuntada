import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarDays, ClipboardList, Crown, Users, Wallet } from "lucide-react";
import type { ChecklistItem, ExpenseSettlement, Gathering, Participant } from "../services/gatheringService";
import { isGatheringServiceEnabled } from "../utils/gatheringModules";
import { formatMoney } from "../utils/gatheringHelpers";
import "./OrganizerSummary.css";

type Props = {
  gathering: Gathering;
  participant: Participant;
  checklist?: ChecklistItem[];
  checklistError: boolean;
  settlement: ExpenseSettlement | null;
  settlementError?: boolean;
};

function names(people: { name: string }[]) {
  const first = people.slice(0, 3).map(p => p.name).join(", ");
  return people.length > 3 ? `${first} y ${people.length - 3} más` : first;
}

export function OrganizerSummary({ gathering, participant, checklist, checklistError, settlement, settlementError }: Props) {
  if (!participant.isOrganizer || gathering.status === "CANCELLED") return null;
  const base = `/j/${gathering.slug}`;
  const choosingDate = gathering.status === "OPEN";
  const unanswered = gathering.participants.filter(p => choosingDate ? !p.availabilities?.length : !p.rsvpStatus);
  const unassigned = checklist?.filter(item => !item.isReady && !item.assignedParticipantId);
  const notReady = checklist?.filter(item => !item.isReady);
  const transfers = settlement?.transfers.filter(t => !t.settled) ?? [];
  const tasksEnabled = isGatheringServiceEnabled(gathering, "pendientes");
  const expensesEnabled = isGatheringServiceEnabled(gathering, "cuentas");
  return <section className="organizer-summary" aria-labelledby="organizer-summary-title">
    <div className="organizer-summary-heading"><span className="organizer-crown"><Crown size={23} aria-hidden="true" /></span><div><span className="section-kicker">PARA QUIEN ORGANIZA</span><h2 id="organizer-summary-title">Tu juntada, de un vistazo</h2><p>Lo que falta resolver y el próximo paso, todo a mano.</p></div></div>
    <div className="organizer-summary-grid">
      <Link to={`${base}/${choosingDate ? "fecha" : "invitados"}`} className={`organizer-summary-card ${unanswered.length ? "needs-attention" : "is-ready"}`}>
        <span className="organizer-card-top"><Users size={20} aria-hidden="true" /><ArrowUpRight size={17} aria-hidden="true" /></span>
        <strong>{unanswered.length ? `${unanswered.length} sin responder` : "Todos respondieron"}</strong>
        <span>{unanswered.length ? names(unanswered) : choosingDate ? "Ya podés comparar los horarios del grupo." : "Revisá quién viene y sus acompañantes."}</span>
        <small>{choosingDate ? "Ver disponibilidades" : "Ver invitados"}</small>
      </Link>
      {choosingDate ? <Link to={`${base}/fecha`} className="organizer-summary-card needs-attention"><span className="organizer-card-top"><CalendarDays size={20} aria-hidden="true" /><ArrowUpRight size={17} aria-hidden="true" /></span><strong>Falta confirmar la fecha</strong><span>Compará las opciones y elegí el horario de la juntada.</span><small>Definir fecha y lugar</small></Link> : null}
      {tasksEnabled ? <Link to={`${base}/pendientes`} className={`organizer-summary-card ${checklistError || !checklist || !checklist.length ? "" : notReady?.length ? "needs-attention" : "is-ready"}`}>
        <span className="organizer-card-top"><ClipboardList size={20} aria-hidden="true" /><ArrowUpRight size={17} aria-hidden="true" /></span>
        <strong>{checklistError ? "No pudimos cargar los pendientes" : !checklist ? "Cargando pendientes…" : !checklist.length ? "Armá la lista de útiles" : unassigned?.length ? `${unassigned.length} sin responsable` : notReady?.length ? `${notReady.length} por completar` : "Todo listo para llevar"}</strong>
        <span>{checklistError ? "Abrí Pendientes para volver a intentarlo." : !checklist ? "Consultando la lista del grupo." : unassigned?.length ? names(unassigned.map(item => ({ name: item.label }))) : notReady?.length ? "Ya tienen responsable; falta marcarlos como listos." : checklist.length ? `${checklist.length} elementos resueltos.` : "Sumá lo que hace falta y repartí responsabilidades."}</span>
        <small>Organizar pendientes</small>
      </Link> : null}
      {expensesEnabled ? <Link to={`${base}/cuentas${settlement?.allReady && !settlementError ? "/transferencias" : ""}`} className={`organizer-summary-card ${settlementError || !settlement || !settlement.expenses.length ? "" : settlement.allReady && !transfers.length ? "is-ready" : "needs-attention"}`}>
        <span className="organizer-card-top"><Wallet size={20} aria-hidden="true" /><ArrowUpRight size={17} aria-hidden="true" /></span>
        <strong>{settlementError ? "No pudimos cargar las cuentas" : !settlement ? "Cargando cuentas…" : !settlement.expenses.length ? "Todavía no hay gastos" : !settlement.allReady ? "Falta cerrar los gastos" : transfers.length ? `${transfers.length} ${transfers.length === 1 ? "transferencia pendiente" : "transferencias pendientes"}` : "Cuentas saldadas"}</strong>
        <span>{settlementError ? "Abrí Gastos y cuentas para reintentar." : !settlement ? "Consultando el reparto del grupo." : !settlement.expenses.length ? "Cargá las compras y quién pagó cada una." : !settlement.allReady ? `${names(settlement.pendingReadyParticipants)} · reparto preliminar` : transfers.length ? `${formatMoney(transfers.reduce((total, t) => total + t.amountCents, 0))} por resolver entre el grupo.` : "No quedan transferencias por confirmar."}</span>
        <small>{settlement?.allReady && !settlementError ? "Ver transferencias" : "Revisar gastos"}</small>
      </Link> : null}
    </div>
  </section>;
}
