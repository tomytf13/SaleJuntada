import { ParticipantAuthService } from "../participants/participant-auth.service";
import { RsvpService } from "../rsvp/rsvp.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateGatheringDto } from "./dto/create-gathering.dto";
import { GatheringsService } from "./gatherings.service";

/**
 * Prisma que registra si se llegó a escribir. Los tests de rango inválido
 * comprueban que la validación corta antes de tocar la base.
 */
function buildPrisma() {
  const created: unknown[] = [];
  const prisma = {
    $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
      callback(prisma),
    ),
    userPaymentProfile: { findUnique: jest.fn().mockResolvedValue(null) },
    gathering: {
      create: jest.fn((args: unknown) => {
        created.push(args);
        return Promise.resolve({ id: "gathering", slug: "asado", participants: [] });
      }),
    },
    purchasePlan: { create: jest.fn() },
  } as unknown as PrismaService & { gathering: { create: jest.Mock } };

  return { prisma, created };
}

function baseDto(overrides: Partial<CreateGatheringDto> = {}) {
  return {
    title: "Asado con los pibes",
    organizerName: "Tomy",
    windowStart: "2026-09-05T22:00:00.000Z",
    windowEnd: "2026-09-07T03:00:00.000Z",
    durationMinutes: 180,
    dailyStartMinutes: 19 * 60,
    dailyEndMinutes: 24 * 60,
    ...overrides,
  } as CreateGatheringDto;
}

function buildService(prisma: PrismaService) {
  return new GatheringsService(prisma, new ParticipantAuthService(prisma), new RsvpService(prisma, new ParticipantAuthService(prisma)));
}

describe("create validación de la ventana", () => {
  it("acepta un rango válido", async () => {
    const { prisma, created } = buildPrisma();

    await buildService(prisma).create(baseDto());

    expect(created).toHaveLength(1);
  });

  it("rechaza un rango invertido", async () => {
    // Antes se creaba igual: generaba cero horarios y la juntada quedaba
    // inservible sin ningún mensaje de error.
    const { prisma, created } = buildPrisma();

    await expect(
      buildService(prisma).create(
        baseDto({
          windowStart: "2026-09-07T03:00:00.000Z",
          windowEnd: "2026-09-05T22:00:00.000Z",
        }),
      ),
    ).rejects.toThrow("La juntada tiene que terminar después de empezar");
    expect(created).toHaveLength(0);
  });

  it("rechaza un rango de duración cero", async () => {
    const { prisma, created } = buildPrisma();

    await expect(
      buildService(prisma).create(
        baseDto({
          windowStart: "2026-09-05T22:00:00.000Z",
          windowEnd: "2026-09-05T22:00:00.000Z",
        }),
      ),
    ).rejects.toThrow("La juntada tiene que terminar después de empezar");
    expect(created).toHaveLength(0);
  });

  it("rechaza una franja diaria que no entra la duración", async () => {
    const { prisma } = buildPrisma();

    await expect(
      buildService(prisma).create(
        baseDto({
          durationMinutes: 300,
          dailyStartMinutes: 20 * 60,
          dailyEndMinutes: 22 * 60,
        }),
      ),
    ).rejects.toThrow("La franja horaria debe permitir al menos una opción completa");
  });

  it("rechaza una zona horaria inexistente", async () => {
    const { prisma } = buildPrisma();

    await expect(
      buildService(prisma).create(baseDto({ timeZone: "Marte/Olympus" })),
    ).rejects.toThrow("La zona horaria no es válida");
  });
});
