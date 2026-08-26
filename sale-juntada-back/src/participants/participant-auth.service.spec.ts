import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { GatheringStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ParticipantAuthService } from "./participant-auth.service";
import { generateParticipantToken } from "./participant-token";

const TOKEN = generateParticipantToken();
const OTHER_TOKEN = generateParticipantToken();

/**
 * Prisma falso que responde como la base real: `findFirst` sólo devuelve la
 * fila si el `where` coincide, incluido el `responseToken` cuando se filtra
 * por él. Sin eso los tests de token cruzado no probarían nada.
 */
function prismaWith(rows: Array<Record<string, unknown>>) {
  const matches = (row: Record<string, unknown>, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => row[key] === value);

  return {
    participant: {
      findFirst: jest.fn(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(rows.find((row) => matches(row, where)) ?? null),
      ),
    },
  } as unknown as PrismaService;
}

const participantRow = {
  id: "guest",
  gatheringId: "gathering",
  name: "Mica",
  isOrganizer: false,
  responseToken: TOKEN,
  gathering: { id: "gathering", slug: "asado", status: GatheringStatus.OPEN },
};

const organizerRow = {
  ...participantRow,
  id: "host",
  name: "Tomy",
  isOrganizer: true,
};

describe("ParticipantAuthService.requireParticipant", () => {
  it("acepta el token correcto", async () => {
    const auth = new ParticipantAuthService(prismaWith([participantRow]));

    await expect(
      auth.requireParticipant("gathering", "guest", TOKEN),
    ).resolves.toMatchObject({ id: "guest" });
  });

  it("rechaza un token que pertenece a otro participante", async () => {
    const auth = new ParticipantAuthService(prismaWith([participantRow]));

    await expect(
      auth.requireParticipant("gathering", "guest", OTHER_TOKEN),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rechaza la falta de token", async () => {
    const auth = new ParticipantAuthService(prismaWith([participantRow]));

    await expect(
      auth.requireParticipant("gathering", "guest", undefined),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("no encuentra al participante si el token es de otra juntada", async () => {
    const auth = new ParticipantAuthService(prismaWith([participantRow]));

    await expect(
      auth.requireParticipant("otra-juntada", "guest", TOKEN),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("conserva el mensaje que le pasa cada pantalla", async () => {
    const auth = new ParticipantAuthService(prismaWith([participantRow]));

    await expect(
      auth.requireParticipant("gathering", "guest", OTHER_TOKEN, "Mensaje propio"),
    ).rejects.toThrow("Mensaje propio");
  });
});

describe("ParticipantAuthService.requireOrganizer", () => {
  it("acepta a quien organiza", async () => {
    const auth = new ParticipantAuthService(prismaWith([organizerRow]));

    await expect(
      auth.requireOrganizer("gathering", "host", TOKEN),
    ).resolves.toMatchObject({ isOrganizer: true });
  });

  it("rechaza a un participante común aunque su token sea válido", async () => {
    const auth = new ParticipantAuthService(prismaWith([participantRow]));

    await expect(
      auth.requireOrganizer("gathering", "guest", TOKEN),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rechaza antes de mirar el rol si el token no sirve", async () => {
    const auth = new ParticipantAuthService(prismaWith([organizerRow]));

    await expect(
      auth.requireOrganizer("gathering", "host", OTHER_TOKEN),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe("ParticipantAuthService.requireActiveParticipant", () => {
  it("rechaza una juntada cancelada", async () => {
    const auth = new ParticipantAuthService(
      prismaWith([
        {
          ...participantRow,
          gathering: {
            id: "gathering",
            slug: "asado",
            status: GatheringStatus.CANCELLED,
          },
        },
      ]),
    );

    await expect(
      auth.requireActiveParticipant("gathering", "guest", TOKEN),
    ).rejects.toThrow("La juntada está cancelada");
  });
});

describe("ParticipantAuthService.findByToken", () => {
  it("resuelve al participante sin conocer su id", async () => {
    const auth = new ParticipantAuthService(prismaWith([participantRow]));

    await expect(auth.findByToken("gathering", TOKEN)).resolves.toEqual({
      id: "guest",
      name: "Mica",
      isOrganizer: false,
    });
  });

  it("devuelve null sin token en vez de lanzar", async () => {
    const auth = new ParticipantAuthService(prismaWith([participantRow]));

    await expect(auth.findByToken("gathering", undefined)).resolves.toBeNull();
  });

  it("devuelve null con un token de otra juntada", async () => {
    const auth = new ParticipantAuthService(prismaWith([participantRow]));

    await expect(auth.findByToken("otra-juntada", TOKEN)).resolves.toBeNull();
  });

  it("nunca expone el responseToken en el resultado", async () => {
    const auth = new ParticipantAuthService(prismaWith([participantRow]));

    const resolved = await auth.findByToken("gathering", TOKEN);

    expect(resolved).not.toHaveProperty("responseToken");
  });
});
