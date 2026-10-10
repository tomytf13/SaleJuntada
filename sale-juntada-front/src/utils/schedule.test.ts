import { describe, it, expect } from "vitest";
import { calendarDate, scheduleInstant, shiftDay } from "./schedule";
import { decorateSlot } from "./gatheringHelpers";
const zone = "America/Argentina/Tucuman";
describe("horarios nocturnos", () => {
  it("mantiene el día del evento aunque UTC esté en el siguiente", () => {
    expect(calendarDate("2026-10-11T00:00:00Z", zone)).toBe("2026-10-10");
    expect(scheduleInstant("2026-10-10", 1260, zone).toISOString()).toBe(
      "2026-10-11T00:00:00.000Z",
    );
    expect(scheduleInstant("2026-10-10", 1680, zone).toISOString()).toBe(
      "2026-10-11T07:00:00.000Z",
    );
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("muestra la hora de fin y el cruce de día en una opción", () => {
    expect(
      decorateSlot(
        {
          id: "night",
          startsAt: "2026-10-11T00:00:00Z",
          endsAt: "2026-10-11T07:00:00Z",
        },
        zone,
      ).range,
    ).toBe("21:00 – 04:00 (día siguiente)");
  });
});
