import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { GatheringStatus, RsvpStatus } from "@prisma/client";
import { ParticipantAuthService } from "../participants/participant-auth.service";
import { generateParticipantToken } from "../participants/participant-token";
import { PrismaService } from "../prisma/prisma.service";
import { RsvpService, summarizeRsvp } from "./rsvp.service";

const TOKEN = generateParticipantToken();
const OTHER_TOKEN = generateParticipantToken();

type Options = {
  finalizedStart?: Date | null;
  status?: GatheringStatus;
  participantGatheringId?: string;
};

/**
 * Prisma falso que responde como la base: `findFirst` sólo devuelve al
 * participante si el `where` coincide en todo, incluida la juntada. Sin eso
 * los tests de token cruzado no probarían nada.
 */
function buildService({
  finalizedStart = new Date("2026-09-05T22:00:00.000Z"),
  status = GatheringStatus.CONFIRMED,
  participantGatheringId = "gathering",
}: Options = {}) {
  const updates: Array<Record<string, unknown>> = [];

  const participantRow = {
    id: "guest",
    gatheringId: participantGatheringId,
    name: "Mica",
    isOrganizer: false,
    responseToken: TOKEN,
    rsvpStatus: null,
    plusOnes: 0,
    gathering: { id: "gathering", slug: "asado", status },
  };

  const prisma = {
    participant: {
      findFirst: jest.fn(({ where }: { where: Record<string, unknown> }) => {
        const matches = Object.entries(where).every(
          ([key, value]) =>
            (participantRow as Record<string, unknown>)[key] === value,
        );
        return Promise.resolve(matches ? participantRow : null);
      }),
      findMany: jest.fn().mockResolvedValue([
        { rsvpStatus: RsvpStatus.GOING, plusOnes: 0 },
        { rsvpStatus: null, plusOnes: 0 },
      ]),
      update: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        return Promise.resolve({
          id: "guest",
          name: "Mica",
          rsvpStatus: data.rsvpStatus,
          plusOnes: data.plusOnes,
          rsvpAt: data.rsvpAt,
        });
      }),
    },
    gathering: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ finalizedStart }),
    },
  } as unknown as PrismaService;

  return {
    service: new RsvpService(prisma, new ParticipantAuthService(prisma)),
    updates,
    prisma,
  };
}

describe("RsvpService.setRsvp — camino feliz", () => {
  it("guarda la respuesta de un participante válido", async () => {
    const { service } = buildService();

    const result = await service.setRsvp("gathering", "guest", TOKEN, {
      status: RsvpStatus.GOING,
    });

    expect(result.rsvpStatus).toBe(RsvpStatus.GOING);
    expect(result.participantId).toBe("guest");
  });

  it("permite cambiar la respuesta", async () => {
    const { service, updates } = buildService();

    await service.setRsvp("gathering", "guest", TOKEN, {
      status: RsvpStatus.GOING,
    });
    await service.setRsvp("gathering", "guest", TOKEN, {
      status: RsvpStatus.MAYBE,
    });

    expect(updates[0].rsvpStatus).toBe(RsvpStatus.GOING);
    expect(updates[1].rsvpStatus).toBe(RsvpStatus.MAYBE);
  });

  it("actualiza rsvpAt en cada mutación válida", async () => {
    const { service, updates } = buildService();

    await service.setRsvp("gathering", "guest", TOKEN, {
      status: RsvpStatus.GOING,
    });

    expect(updates[0].rsvpAt).toBeInstanceOf(Date);
  });

  it("es idempotente: repetir la misma respuesta deja el mismo estado", async () => {
    const { service, updates } = buildService();
    const payload = { status: RsvpStatus.GOING, plusOnes: 1 };

    await service.setRsvp("gathering", "guest", TOKEN, payload);
    await service.setRsvp("gathering", "guest", TOKEN, payload);

    expect(updates[0].rsvpStatus).toBe(updates[1].rsvpStatus);
    expect(updates[0].plusOnes).toBe(updates[1].plusOnes);
  });
});

describe("RsvpService.setRsvp — plusOnes", () => {
  it("guarda los acompañantes cuando la respuesta es GOING", async () => {
    const { service, updates } = buildService();

    await service.setRsvp("gathering", "guest", TOKEN, {
      status: RsvpStatus.GOING,
      plusOnes: 2,
    });

    expect(updates[0].plusOnes).toBe(2);
  });

  it("fuerza plusOnes a 0 cuando la respuesta no es GOING", async () => {
    // Quien no va no lleva a nadie. Es regla del servidor: el cliente
    // podría mandar cualquier cosa.
    const { service, updates } = buildService();

    await service.setRsvp("gathering", "guest", TOKEN, {
      status: RsvpStatus.NOT_GOING,
      plusOnes: 3,
    });

    expect(updates[0].plusOnes).toBe(0);
  });

  it("también fuerza plusOnes a 0 con MAYBE", async () => {
    const { service, updates } = buildService();

    await service.setRsvp("gathering", "guest", TOKEN, {
      status: RsvpStatus.MAYBE,
      plusOnes: 5,
    });

    expect(updates[0].plusOnes).toBe(0);
  });

  it("usa 0 cuando no se mandan acompañantes", async () => {
    const { service, updates } = buildService();

    await service.setRsvp("gathering", "guest", TOKEN, {
      status: RsvpStatus.GOING,
    });

    expect(updates[0].plusOnes).toBe(0);
  });
});

describe("RsvpService.setRsvp — el RSVP exige fecha confirmada", () => {
  it("rechaza responder en una juntada sin fecha", async () => {
    // Regla central de P1: sin fecha, ser participante ya significa "me
    // interesa" y la pregunta es cuándo podés, no si venís.
    const { service, updates } = buildService({
      finalizedStart: null,
      status: GatheringStatus.OPEN,
    });

    await expect(
      service.setRsvp("gathering", "guest", TOKEN, {
        status: RsvpStatus.GOING,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(updates).toHaveLength(0);
  });

  it("explica por qué no se puede responder todavía", async () => {
    const { service } = buildService({
      finalizedStart: null,
      status: GatheringStatus.OPEN,
    });

    await expect(
      service.setRsvp("gathering", "guest", TOKEN, {
        status: RsvpStatus.GOING,
      }),
    ).rejects.toThrow("todavía no tiene una fecha confirmada");
  });

  it("acepta la respuesta en cuanto la juntada tiene fecha", async () => {
    const { service, updates } = buildService({
      finalizedStart: new Date("2026-09-05T22:00:00.000Z"),
    });

    await service.setRsvp("gathering", "guest", TOKEN, {
      status: RsvpStatus.GOING,
    });

    expect(updates).toHaveLength(1);
  });
});

describe("RsvpService.setRsvp — juntada cancelada", () => {
  it("rechaza responder en una juntada cancelada", async () => {
    const { service, updates } = buildService({
      status: GatheringStatus.CANCELLED,
    });

    await expect(
      service.setRsvp("gathering", "guest", TOKEN, {
        status: RsvpStatus.GOING,
      }),
    ).rejects.toThrow("La juntada está cancelada");
    expect(updates).toHaveLength(0);
  });

  it("rechaza aunque la juntada cancelada conserve su fecha", async () => {
    // Cancelar ya no borra `finalizedStart`, así que el chequeo no puede
    // depender de que la fecha desaparezca: lo que manda es el estado.
    const { service, updates } = buildService({
      status: GatheringStatus.CANCELLED,
      finalizedStart: new Date("2026-09-05T22:00:00.000Z"),
    });

    await expect(
      service.setRsvp("gathering", "guest", TOKEN, {
        status: RsvpStatus.GOING,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(updates).toHaveLength(0);
  });

  it("el estado cancelado se evalúa antes que la fecha", async () => {
    // Si el orden fuera al revés, una juntada cancelada sin fecha daría el
    // mensaje equivocado ("todavía no tiene fecha") en vez del real.
    const { service } = buildService({
      status: GatheringStatus.CANCELLED,
      finalizedStart: null,
    });

    await expect(
      service.setRsvp("gathering", "guest", TOKEN, {
        status: RsvpStatus.GOING,
      }),
    ).rejects.toThrow("La juntada está cancelada");
  });
});

describe("RsvpService.setRsvp — autorización", () => {
  it("rechaza sin token", async () => {
    const { service } = buildService();

    await expect(
      service.setRsvp("gathering", "guest", undefined, {
        status: RsvpStatus.GOING,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rechaza el token de otra persona", async () => {
    const { service, updates } = buildService();

    await expect(
      service.setRsvp("gathering", "guest", OTHER_TOKEN, {
        status: RsvpStatus.GOING,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(updates).toHaveLength(0);
  });

  it("rechaza un participante que pertenece a otra juntada", async () => {
    const { service, updates } = buildService({
      participantGatheringId: "otra-juntada",
    });

    await expect(
      service.setRsvp("gathering", "guest", TOKEN, {
        status: RsvpStatus.GOING,
      }),
    ).rejects.toThrow("Participante no encontrado");
    expect(updates).toHaveLength(0);
  });
});

describe("summarizeRsvp", () => {
  it("cuenta cada estado por separado", () => {
    const summary = summarizeRsvp([
      { rsvpStatus: RsvpStatus.GOING, plusOnes: 0 },
      { rsvpStatus: RsvpStatus.GOING, plusOnes: 0 },
      { rsvpStatus: RsvpStatus.MAYBE, plusOnes: 0 },
      { rsvpStatus: RsvpStatus.NOT_GOING, plusOnes: 0 },
      { rsvpStatus: null, plusOnes: 0 },
    ]);

    expect(summary).toEqual({
      going: 2,
      maybe: 1,
      notGoing: 1,
      pending: 1,
      goingHeadcount: 2,
    });
  });

  it("cuenta como pendientes a quienes no respondieron", () => {
    const summary = summarizeRsvp([
      { rsvpStatus: null, plusOnes: 0 },
      { rsvpStatus: null, plusOnes: 0 },
    ]);

    expect(summary.pending).toBe(2);
    expect(summary.going).toBe(0);
  });

  it("suma 1 + plusOnes en el headcount", () => {
    // Tomy +0, Mica +1, Fede +2 → 3 respuestas, 6 personas.
    const summary = summarizeRsvp([
      { rsvpStatus: RsvpStatus.GOING, plusOnes: 0 },
      { rsvpStatus: RsvpStatus.GOING, plusOnes: 1 },
      { rsvpStatus: RsvpStatus.GOING, plusOnes: 2 },
    ]);

    expect(summary.going).toBe(3);
    expect(summary.goingHeadcount).toBe(6);
  });

  it("ignora los acompañantes de quienes no van", () => {
    const summary = summarizeRsvp([
      { rsvpStatus: RsvpStatus.GOING, plusOnes: 1 },
      // No debería pasar (el servidor lo fuerza a 0), pero el resumen no
      // tiene por qué confiar en eso.
      { rsvpStatus: RsvpStatus.MAYBE, plusOnes: 5 },
      { rsvpStatus: RsvpStatus.NOT_GOING, plusOnes: 5 },
    ]);

    expect(summary.goingHeadcount).toBe(2);
  });

  it("devuelve todo en cero sin participantes", () => {
    expect(summarizeRsvp([])).toEqual({
      going: 0,
      maybe: 0,
      notGoing: 0,
      pending: 0,
      goingHeadcount: 0,
    });
  });
});
