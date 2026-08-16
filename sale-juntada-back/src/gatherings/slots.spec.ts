import { buildSlots, calendarDayInZone, zonedWallClockToUtc } from "./slots";

const BUENOS_AIRES = "America/Argentina/Buenos_Aires";

describe("slots", () => {
  it("genera los horarios en la zona de la juntada, no en la del servidor", () => {
    const slots = buildSlots({
      // 19:00 del 1/9 en Argentina.
      windowStart: new Date("2026-09-01T22:00:00.000Z"),
      // 02:00 del 4/9 en Argentina.
      windowEnd: new Date("2026-09-04T05:00:00.000Z"),
      timeZone: BUENOS_AIRES,
      durationMinutes: 180,
      dailyStartMinutes: 19 * 60,
      dailyEndMinutes: 26 * 60,
      slotStepMinutes: 60,
    });

    // 5 opciones por día (19, 20, 21, 22 y 23 hs) durante 3 días.
    expect(slots).toHaveLength(15);
    expect(slots[0].startsAt).toBe("2026-09-01T22:00:00.000Z");
    expect(slots[0].endsAt).toBe("2026-09-02T01:00:00.000Z");
    expect(slots[4].startsAt).toBe("2026-09-02T02:00:00.000Z");
    expect(slots[5].startsAt).toBe("2026-09-02T22:00:00.000Z");
  });

  it("produce los mismos instantes sin importar el huso del proceso", () => {
    const config = {
      windowStart: new Date("2026-09-01T22:00:00.000Z"),
      windowEnd: new Date("2026-09-04T05:00:00.000Z"),
      timeZone: BUENOS_AIRES,
      durationMinutes: 180,
      dailyStartMinutes: 19 * 60,
      dailyEndMinutes: 26 * 60,
      slotStepMinutes: 60,
    };
    const original = process.env.TZ;

    process.env.TZ = "Europe/Madrid";
    const fromMadrid = buildSlots(config).map((slot) => slot.startsAt);
    process.env.TZ = "Pacific/Auckland";
    const fromAuckland = buildSlots(config).map((slot) => slot.startsAt);
    process.env.TZ = original;

    expect(fromMadrid).toEqual(fromAuckland);
  });

  it("mantiene la hora de pared cuando la zona cambia por horario de verano", () => {
    // En 2026 Nueva York adelanta el reloj el domingo 8 de marzo.
    const saturday = zonedWallClockToUtc(
      { year: 2026, month: 3, day: 7 },
      13 * 60,
      "America/New_York",
    );
    const sunday = zonedWallClockToUtc(
      { year: 2026, month: 3, day: 8 },
      13 * 60,
      "America/New_York",
    );

    // Mismo horario de pared, offsets distintos: EST (-5) y EDT (-4).
    expect(saturday.toISOString()).toBe("2026-03-07T18:00:00.000Z");
    expect(sunday.toISOString()).toBe("2026-03-08T17:00:00.000Z");
  });

  it("respeta las franjas que terminan al día siguiente", () => {
    const slots = buildSlots({
      windowStart: new Date("2026-09-01T00:00:00.000Z"),
      windowEnd: new Date("2026-09-02T12:00:00.000Z"),
      timeZone: BUENOS_AIRES,
      durationMinutes: 120,
      dailyStartMinutes: 22 * 60,
      dailyEndMinutes: 26 * 60,
      slotStepMinutes: 120,
    });

    // Cada día ofrece las 22:00 y las 00:00 del día siguiente, en hora
    // argentina. El primer día es el 31/8: medianoche UTC del 1/9 todavía
    // cae el 31/8 acá, así que la franja de esa noche entra en la ventana.
    expect(slots.map((slot) => slot.startsAt)).toEqual([
      "2026-09-01T01:00:00.000Z",
      "2026-09-01T03:00:00.000Z",
      "2026-09-02T01:00:00.000Z",
      "2026-09-02T03:00:00.000Z",
    ]);
  });

  it("ubica el día calendario según la zona y no según UTC", () => {
    // 00:30 UTC del 2/9 todavía es 21:30 del 1/9 en Argentina.
    expect(
      calendarDayInZone(new Date("2026-09-02T00:30:00.000Z"), BUENOS_AIRES),
    ).toEqual({ year: 2026, month: 9, day: 1 });
  });

  it("no devuelve nada si la franja no alcanza para la duración", () => {
    expect(
      buildSlots({
        windowStart: new Date("2026-09-01T00:00:00.000Z"),
        windowEnd: new Date("2026-09-05T00:00:00.000Z"),
        timeZone: BUENOS_AIRES,
        durationMinutes: 300,
        dailyStartMinutes: 20 * 60,
        dailyEndMinutes: 22 * 60,
        slotStepMinutes: 60,
      }),
    ).toEqual([]);
  });
});
