import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it } from "vitest";
import { OrganizerSummary } from "./OrganizerSummary";
import type { Gathering, Participant, ChecklistItem, ExpenseSettlement } from "../services/gatheringService";
afterEach(cleanup);
const host = { id: "host", name: "Tomy", isOrganizer: true, rsvpStatus: "GOING", availabilities: [] } as unknown as Participant;
const gathering = { id: "g", slug: "asado", title: "Asado", windowStart: "2026-10-11T00:00:00Z", windowEnd: "2026-10-11T07:00:00Z", durationMinutes: 420, status: "CONFIRMED", participants: [host, { ...host, id: "guest", name: "Sofi", isOrganizer: false, rsvpStatus: null }], disabledServices: [] } as Gathering;
const checklist = [{ id: "coal", label: "Carbón", assignedParticipantId: null, isReady: false }, { id: "ice", label: "Hielo", assignedParticipantId: null, isReady: true }] as ChecklistItem[];
const settlement = { allReady: true, expenses: [{ id: "e" }], transfers: [{ id: "t", amountCents: 2000, settled: false }, { id: "done", amountCents: 1000, settled: true }], pendingReadyParticipants: [] } as unknown as ExpenseSettlement;
function show(overrides: Partial<Parameters<typeof OrganizerSummary>[0]> = {}) {
 return render(<MemoryRouter><OrganizerSummary gathering={gathering} participant={host} checklist={checklist} checklistError={false} settlement={settlement} {...overrides} /></MemoryRouter>);
}
it("shows actionable counts, excluding ready items and settled transfers", () => {
 show();
 expect(screen.getByRole("link", { name: /1 sin responder/ })).toHaveAttribute("href", "/j/asado/invitados");
 expect(screen.getByRole("link", { name: /1 sin responsable Carbón/ })).toHaveAttribute("href", "/j/asado/pendientes");
 expect(screen.getByRole("link", { name: /1 transferencia pendiente/ })).toHaveAttribute("href", "/j/asado/cuentas/transferencias");
});
it("does not expose organizer controls to guests or cancelled events", () => {
 const view = show({ participant: { ...host, isOrganizer: false } });
 expect(screen.queryByRole("region")).not.toBeInTheDocument();
 view.unmount(); show({ gathering: { ...gathering, status: "CANCELLED" } });
 expect(screen.queryByRole("region")).not.toBeInTheDocument();
});
it("distinguishes availability responses from attendance and hides disabled services", () => {
 show({ gathering: { ...gathering, status: "OPEN", disabledServices: ["pendientes", "cuentas"], participants: [{ ...host, availabilities: [{ kind: "UNAVAILABLE" }] as Participant["availabilities"] }] } });
 expect(screen.getByText("Todos respondieron")).toBeInTheDocument();
 expect(screen.getByRole("link", { name: /Falta confirmar la fecha/ })).toHaveAttribute("href", "/j/asado/fecha");
 expect(screen.queryByText("Organizar pendientes")).not.toBeInTheDocument();
 expect(screen.queryByText("Ver transferencias")).not.toBeInTheDocument();
});
it("does not claim everything is resolved while data is unavailable", () => {
 show({ checklist: undefined, settlement: null });
 expect(screen.getByText("Cargando pendientes…")).toBeInTheDocument();
 expect(screen.getByText("Cargando cuentas…")).toBeInTheDocument();
 expect(screen.queryByText("Cuentas saldadas")).not.toBeInTheDocument();
});
it("shows errors instead of stale reassuring data", () => {
 show({ checklistError: true, settlementError: true });
 expect(screen.getByText("No pudimos cargar los pendientes")).toBeInTheDocument();
 expect(screen.getByText("No pudimos cargar las cuentas")).toBeInTheDocument();
});
it("keeps preliminary balances distinct from transfers due", () => {
 show({ settlement: { ...settlement, allReady: false, pendingReadyParticipants: [{ participantId: "guest", name: "Sofi" }] } });
 expect(screen.getByText("Falta cerrar los gastos")).toBeInTheDocument();
 expect(screen.getByText(/Sofi · reparto preliminar/)).toBeInTheDocument();
 expect(screen.queryByText("1 transferencia pendiente")).not.toBeInTheDocument();
});
