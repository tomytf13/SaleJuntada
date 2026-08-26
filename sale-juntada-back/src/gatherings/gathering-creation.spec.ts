import { GatheringStatus, RsvpStatus } from "@prisma/client";
import { ParticipantAuthService } from "../participants/participant-auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { RsvpService } from "../rsvp/rsvp.service";
import { CreateGatheringDto } from "./dto/create-gathering.dto";
import { GatheringsService } from "./gatherings.service";
import { calendarDayInZone } from "./slots";

type CreatedGathering = {
  data: Record<string, unknown> & {
    participants: { create: Record<string, unknown> };
  };
};

function buildPrisma() {
  const created: CreatedGathering[] = [];
  const prisma = {
    $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
      callback(prisma),
    ),
    userPaymentProfile: { findUnique: jest.fn().mockResolvedValue(null) },
    gathering: {
      create: jest.fn((args: CreatedGathering) => {
        created.push(args);
        return Promise.resolve({
          id: "gathering",
          slug: "asado",
          participants: [],
        });
      }),
    },
    purchasePlan: { create: jest.fn() },
  } as unknown as PrismaService;

  return { prisma, created };
}

function buildService(prisma: PrismaService) {
  const auth = new ParticipantAuthService(prisma);
  return new GatheringsService(prisma, auth, new RsvpService(prisma, auth));
}

function baseDto(overrides: Partial<CreateGatheringDto> = {}) {
  return {
    title: "Asado del sábado",
    organizerName: "Tomy",
    ...overrides,
  } as CreateGatheringDto;
}

/** Lo que efectivamente se mandó a `gathering.create`. */
function creationData(created: CreatedGathering[]) {
  return created[0].data;
}

function organizerData(created: CreatedGathering[]) {
  return created[0].data.participants.create;
}

const TUCUMAN = "America/Argentina/Tucuman";

describe("create — modo con fecha", () => {
  it("nace confirmada con la fecha indicada", async () => {
    const { prisma, created } = buildPrisma();

    await buildService(prisma).create(
      baseDto({ startsAt: "2026-08-29T21:00:00.000Z" }),
    );

    const data = creationData(created);
    expect(data.status).toBe(GatheringStatus.CONFIRMED);
    expect((data.finalizedStart as Date).toISOString()).toBe(
      "2026-08-29T21:00:00.000Z",
    );
  });

  it("no inventa una hora de fin", async () => {
    // `durationMinutes` es cuánto dura un bloque candidato del buscador de
    // horarios, no cuánto dura la juntada. Nadie dijo a qué hora termina.
    const { prisma, created } = buildPrisma();

    await buildService(prisma).create(
      baseDto({ startsAt: "2026-08-29T21:00:00.000Z", durationMinutes: 180 }),
    );

    expect(creationData(created).finalizedEnd).toBeNull();
  });

  it("deja al organizador confirmado", async () => {
    const { prisma, created } = buildPrisma();

    await buildService(prisma).create(
      baseDto({ startsAt: "2026-08-29T21:00:00.000Z" }),
    );

    const organizer = organizerData(created);
    expect(organizer.rsvpStatus).toBe(RsvpStatus.GOING);
    expect(organizer.plusOnes).toBe(0);
    expect(organizer.rsvpAt).toBeInstanceOf(Date);
  });

  it("no pide la ventana: la deriva del día local de la fecha", async () => {
    const { prisma, created } = buildPrisma();

    await buildService(prisma).create(
      baseDto({ startsAt: "2026-08-30T00:30:00.000Z", timeZone: TUCUMAN }),
    );

    const data = creationData(created);
    const windowStart = data.windowStart as Date;
    const windowEnd = data.windowEnd as Date;

    // 00:30 UTC del 30 es todavía el 29 por la noche en Tucumán (UTC-3):
    // la ventana tiene que ser la del 29 local, no la del 30 UTC.
    expect(calendarDayInZone(windowStart, TUCUMAN)).toEqual({
      year: 2026,
      month: 8,
      day: 29,
    });
    expect(windowStart.getTime()).toBeLessThan(windowEnd.getTime());
  });

  it("la ventana derivada contiene a la fecha elegida", async () => {
    const { prisma, created } = buildPrisma();

    await buildService(prisma).create(
      baseDto({ startsAt: "2026-08-29T21:00:00.000Z", timeZone: TUCUMAN }),
    );

    const data = creationData(created);
    const startsAt = data.finalizedStart as Date;
    expect((data.windowStart as Date).getTime()).toBeLessThanOrEqual(
      startsAt.getTime(),
    );
    expect((data.windowEnd as Date).getTime()).toBeGreaterThan(
      startsAt.getTime(),
    );
  });

  it("respeta la zona horaria por defecto del proyecto", async () => {
    const { prisma, created } = buildPrisma();

    await buildService(prisma).create(
      baseDto({ startsAt: "2026-08-29T21:00:00.000Z" }),
    );

    expect(creationData(created).timeZone).toBe(
      "America/Argentina/Buenos_Aires",
    );
  });

  it("acepta una zona horaria explícita", async () => {
    const { prisma, created } = buildPrisma();

    await buildService(prisma).create(
      baseDto({ startsAt: "2026-08-29T21:00:00.000Z", timeZone: "Europe/Madrid" }),
    );

    expect(creationData(created).timeZone).toBe("Europe/Madrid");
  });
});

describe("create — modo buscando fecha", () => {
  const window = {
    windowStart: "2026-09-05T22:00:00.000Z",
    windowEnd: "2026-09-08T03:00:00.000Z",
  };

  it("nace abierta y sin fecha", async () => {
    const { prisma, created } = buildPrisma();

    await buildService(prisma).create(baseDto(window));

    const data = creationData(created);
    expect(data.status).toBe(GatheringStatus.OPEN);
    expect(data.finalizedStart).toBeNull();
    expect(data.finalizedEnd).toBeNull();
  });

  it("usa la ventana que eligió quien crea, sin inventar ninguna", async () => {
    const { prisma, created } = buildPrisma();

    await buildService(prisma).create(baseDto(window));

    const data = creationData(created);
    expect((data.windowStart as Date).toISOString()).toBe(window.windowStart);
    expect((data.windowEnd as Date).toISOString()).toBe(window.windowEnd);
  });

  it("deja al organizador sin RSVP", async () => {
    // Sin fecha el RSVP no aplica para nadie, ni siquiera para quien organiza.
    const { prisma, created } = buildPrisma();

    await buildService(prisma).create(baseDto(window));

    const organizer = organizerData(created);
    expect(organizer.rsvpStatus).toBeNull();
    expect(organizer.plusOnes).toBe(0);
    expect(organizer.rsvpAt).toBeNull();
  });
});

describe("create — validación de los dos modos", () => {
  it("rechaza mandar fecha y ventana a la vez", async () => {
    // Son dos modos distintos. Que uno le gane al otro en silencio sería
    // una regla invisible.
    const { prisma, created } = buildPrisma();

    await expect(
      buildService(prisma).create(
        baseDto({
          startsAt: "2026-08-29T21:00:00.000Z",
          windowStart: "2026-09-05T22:00:00.000Z",
          windowEnd: "2026-09-08T03:00:00.000Z",
        }),
      ),
    ).rejects.toThrow("Los dos juntos no");
    expect(created).toHaveLength(0);
  });

  it("rechaza fecha junto con sólo windowStart", async () => {
    const { prisma } = buildPrisma();

    await expect(
      buildService(prisma).create(
        baseDto({
          startsAt: "2026-08-29T21:00:00.000Z",
          windowStart: "2026-09-05T22:00:00.000Z",
        }),
      ),
    ).rejects.toThrow("Los dos juntos no");
  });

  it("rechaza no decir ni fecha ni ventana", async () => {
    const { prisma, created } = buildPrisma();

    await expect(buildService(prisma).create(baseDto())).rejects.toThrow(
      "Decinos cuándo es la juntada",
    );
    expect(created).toHaveLength(0);
  });

  it("rechaza sólo windowStart", async () => {
    const { prisma } = buildPrisma();

    await expect(
      buildService(prisma).create(
        baseDto({ windowStart: "2026-09-05T22:00:00.000Z" }),
      ),
    ).rejects.toThrow("Decinos cuándo es la juntada");
  });

  it("rechaza sólo windowEnd", async () => {
    const { prisma } = buildPrisma();

    await expect(
      buildService(prisma).create(
        baseDto({ windowEnd: "2026-09-08T03:00:00.000Z" }),
      ),
    ).rejects.toThrow("Decinos cuándo es la juntada");
  });

  it("rechaza una fecha inválida", async () => {
    const { prisma } = buildPrisma();

    await expect(
      buildService(prisma).create(baseDto({ startsAt: "no-es-una-fecha" })),
    ).rejects.toThrow("La fecha de la juntada no es válida");
  });

  it("rechaza una ventana invertida", async () => {
    const { prisma } = buildPrisma();

    await expect(
      buildService(prisma).create(
        baseDto({
          windowStart: "2026-09-08T03:00:00.000Z",
          windowEnd: "2026-09-05T22:00:00.000Z",
        }),
      ),
    ).rejects.toThrow("tiene que terminar después de empezar");
  });

  it("rechaza una zona horaria inexistente", async () => {
    const { prisma } = buildPrisma();

    await expect(
      buildService(prisma).create(
        baseDto({ startsAt: "2026-08-29T21:00:00.000Z", timeZone: "Marte/Olympus" }),
      ),
    ).rejects.toThrow("La zona horaria no es válida");
  });
});

describe("create — compatibilidad con el frontend actual", () => {
  it("sigue aceptando el payload completo que manda hoy la app", async () => {
    // El formulario viejo manda ventana y toda la configuración de horarios,
    // sin `startsAt`. Tiene que seguir funcionando hasta que P1.6 lo cambie.
    const { prisma, created } = buildPrisma();

    await buildService(prisma).create(
      baseDto({
        organizerAvatarUrl: "emoji:🦆",
        locationHint: "Yerba Buena",
        locationLatitude: -26.8083,
        locationLongitude: -65.2176,
        windowStart: "2026-09-05T22:00:00.000Z",
        windowEnd: "2026-09-08T03:00:00.000Z",
        durationMinutes: 180,
        dailyStartMinutes: 19 * 60,
        dailyEndMinutes: 24 * 60,
        slotStepMinutes: 60,
        timeZone: TUCUMAN,
      }),
    );

    const data = creationData(created);
    expect(data.status).toBe(GatheringStatus.OPEN);
    expect(data.locationHint).toBe("Yerba Buena");
    expect(data.slotStepMinutes).toBe(60);
  });
});
