import { describe, expect, it } from "vitest";
import { formatAvailabilitySummary } from "./availability";

describe("formatAvailabilitySummary", () => {
  it("agrupa y ordena los horarios disponibles por día", () => {
    expect(
      formatAvailabilitySummary([
        {
          id: "second",
          startsAt: "2026-08-17T21:00:00",
          endsAt: "2026-08-18T00:00:00",
          kind: "AVAILABLE",
        },
        {
          id: "first",
          startsAt: "2026-08-17T19:00:00",
          endsAt: "2026-08-17T22:00:00",
          kind: "AVAILABLE",
        },
      ]),
    ).toContain("19:00 y 21:00");
  });

  it("no presenta como respuesta una opción que no está disponible", () => {
    expect(
      formatAvailabilitySummary([
        {
          id: "maybe",
          startsAt: "2026-08-17T20:00:00",
          endsAt: "2026-08-17T23:00:00",
          kind: "MAYBE",
        },
      ]),
    ).toBe("Todavía no respondió");
  });
});
