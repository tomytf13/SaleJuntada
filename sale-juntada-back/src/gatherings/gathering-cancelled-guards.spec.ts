import { ConflictException } from "@nestjs/common";
import { AvailabilityKind, GatheringStatus } from "@prisma/client";
import { ParticipantAuthService } from "../participants/participant-auth.service";
import { generateParticipantToken } from "../participants/participant-token";
import { PrismaService } from "../prisma/prisma.service";
import { RsvpService } from "../rsvp/rsvp.service";
import { GatheringsService } from "./gatherings.service";

const TOKEN = generateParticipantToken();

/**
 * Una juntada cancelada que **conserva su fecha**.
 *
 * Ese es justo el caso que la semántica nueva vuelve interesante: desde que
 * cancelar dejó de borrar `finalizedStart`, ningún guard puede deducir
 * "cancelada" a partir de que no haya fecha. Lo que manda es el estado.
 */
function buildCancelledWorld() {
  const gathering = {
    id: "gathering",
    slug: "asado",
    status: GatheringStatus.CANCELLED,
    finalizedStart: new Date("2026-09-06T22:00:00.000Z"),
    finalizedEnd: new Date("2026-09-07T01:00:00.000Z"),
    finalizedLocation: "Yerba Buena",
    timeZone: "America/Argentina/Tucuman",
    windowStart: new Date("2026-09-06T03:00:00.000Z"),
    windowEnd: new Date("2026-09-07T03:00:00.000Z"),
    durationMinutes: 180,
    dailyStartMinutes: 0,
    dailyEndMinutes: 1440,
    slotStepMinutes: 60,
    locationHint: "Yerba Buena",
  };

  const writes: string[] = [];
  const prisma = {
    participant: {
      findFirst: jest.fn().mockResolvedValue({
        id: "guest",
        isOrganizer: true,
        responseToken: TOKEN,
        gathering,
      }),
      updateMany: jest.fn(() => {
        writes.push("participant.updateMany");
        return Promise.resolve({ count: 0 });
      }),
    },
    availability: {
      deleteMany: jest.fn(() => {
        writes.push("availability.deleteMany");
        return Promise.resolve({ count: 0 });
      }),
      createMany: jest.fn(() => {
        writes.push("availability.createMany");
        return Promise.resolve({ count: 0 });
      }),
    },
    gathering: {
      update: jest.fn(() => {
        writes.push("gathering.update");
        return Promise.resolve(gathering);
      }),
      findUnique: jest.fn(() =>
        Promise.resolve({ ...gathering, participants: [] }),
      ),
      findUniqueOrThrow: jest.fn(() => Promise.resolve(gathering)),
    },
    $transaction: jest.fn((arg: unknown) =>
      typeof arg === "function"
        ? (arg as (tx: unknown) => Promise<unknown>)(prisma)
        : Promise.resolve([]),
    ),
  } as unknown as PrismaService;

  const auth = new ParticipantAuthService(prisma);
  return {
    service: new GatheringsService(prisma, auth, new RsvpService(prisma, auth)),
    rsvp: new RsvpService(prisma, auth),
    writes,
    gathering,
  };
}

describe("juntada cancelada — bloqueos con la fecha conservada", () => {
  it("no acepta RSVP aunque conserve finalizedStart", async () => {
    const { rsvp, writes, gathering } = buildCancelledWorld();

    expect(gathering.finalizedStart).not.toBeNull();
    await expect(
      rsvp.setRsvp("gathering", "guest", TOKEN, { status: "GOING" }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(writes).toHaveLength(0);
  });

  it("no acepta nueva disponibilidad", async () => {
    const { service, writes } = buildCancelledWorld();

    await expect(
      service.setAvailability("gathering", "guest", TOKEN, {
        slots: [
          {
            startsAt: "2026-09-06T22:00:00.000Z",
            endsAt: "2026-09-07T01:00:00.000Z",
            kind: AvailabilityKind.AVAILABLE,
          },
        ],
      }),
    ).rejects.toThrow("La juntada está cancelada");
    expect(writes).toHaveLength(0);
  });

  it("no acepta confirmar ni mover la fecha", async () => {
    const { service, writes } = buildCancelledWorld();

    await expect(
      service.finalizeGathering("gathering", "guest", TOKEN, {
        startsAt: "2026-09-07T22:00:00.000Z",
        endsAt: "2026-09-08T01:00:00.000Z",
      }),
    ).rejects.toThrow("La juntada está cancelada");
    expect(writes).toHaveLength(0);
  });

  it("no acepta editar la juntada", async () => {
    const { service, writes } = buildCancelledWorld();

    await expect(
      service.updateGathering("gathering", "guest", TOKEN, {
        title: "Otro nombre",
      }),
    ).rejects.toThrow("La juntada está cancelada");
    expect(writes).toHaveLength(0);
  });
});
