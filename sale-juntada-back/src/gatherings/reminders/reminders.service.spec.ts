import { pendingReminder } from "./reminders.service";

const now = new Date("2026-11-22T19:00:00Z");
const future = {
  status: "CONFIRMED",
  finalizedStart: new Date("2026-11-22T22:00:00Z"),
};
const person = { id: "me", rsvpStatus: null, expensesReadyAt: null };
const going = { ...person, rsvpStatus: "GOING" };
const empty = { allReady: false, transfers: [], expenses: [] };

describe("recordatorios personales", () => {
  it("pide asistencia sólo antes de una fecha confirmada y sin respuesta", () => {
    expect(pendingReminder(person, future, null, now)?.page).toBe("invitados");
    for (const rsvpStatus of ["GOING", "NOT_GOING", "MAYBE"]) {
      expect(
        pendingReminder({ ...person, rsvpStatus }, future, null, now),
      ).toBeNull();
    }
    expect(
      pendingReminder(person, { ...future, status: "OPEN" }, null, now),
    ).toBeNull();
    expect(
      pendingReminder(person, future, null, future.finalizedStart),
    ).toBeNull();
  });
  it("al terminar la juntada sólo avisa si hay cuentas pendientes", () => {
    const closed = { ...future, status: "CLOSED" };
    expect(pendingReminder(going, closed, empty, future.finalizedStart)).toBeNull();
    expect(pendingReminder(person, closed, empty, now)).toBeNull();
    expect(pendingReminder(going, closed, { ...empty, allReady: true, transfers: [{ fromParticipantId: "me", settled: false }] }, now)?.page).toBe("cuentas/transferencias");
  });
  it("recuerda el primer gasto y deja de hacerlo al cargarlo o cerrar la carga", () => {
    expect(pendingReminder(going, future, empty, now)).toBeNull();
    expect(
      pendingReminder(going, future, empty, future.finalizedStart)?.page,
    ).toBe("cuentas");
    const groupExpenses = {
      ...empty,
      expenses: [{ paidByParticipantId: "friend" }],
    };
    expect(pendingReminder(going, future, groupExpenses, now)?.page).toBe(
      "cuentas",
    );
    expect(
      pendingReminder(
        { ...going, expensesReadyAt: now },
        future,
        groupExpenses,
        now,
      ),
    ).toBeNull();
    expect(
      pendingReminder(
        going,
        future,
        { ...empty, expenses: [{ paidByParticipantId: "me" }] },
        now,
      ),
    ).toBeNull();
  });
  it("recuerda sólo las transferencias propias, definitivas y pendientes", () => {
    const due = { fromParticipantId: "me", settled: false };
    const closed = { ...empty, allReady: true, transfers: [due] };
    expect(pendingReminder(going, future, closed, now)?.page).toBe(
      "cuentas/transferencias",
    );
    expect(
      pendingReminder(going, future, { ...closed, allReady: false }, now),
    ).toBeNull();
    expect(
      pendingReminder(
        going,
        future,
        { ...closed, transfers: [{ ...due, fromParticipantId: "friend" }] },
        now,
      ),
    ).toBeNull();
    expect(
      pendingReminder(going, future, { ...closed, transfers: [] }, now),
    ).toBeNull();
    expect(
      pendingReminder(going, { ...future, status: "CANCELLED" }, closed, now),
    ).toBeNull();
  });
});
