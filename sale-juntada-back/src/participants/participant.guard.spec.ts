import {
  BadRequestException,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { ParticipantAuthService } from "./participant-auth.service";
import { ParticipantGuard } from "./participant.guard";
import { generateParticipantToken } from "./participant-token";

const TOKEN = generateParticipantToken();

function contextWith(
  params: Record<string, unknown>,
  headers: Record<string, unknown>,
) {
  const request = { params, headers };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    request,
  } as unknown as ExecutionContext & { request: Record<string, unknown> };
}

function guardWith(participant: { id: string; name: string; isOrganizer: boolean } | null) {
  const auth = {
    findByToken: jest.fn().mockResolvedValue(participant),
  } as unknown as ParticipantAuthService;
  return { guard: new ParticipantGuard(auth), auth };
}

describe("ParticipantGuard", () => {
  it("deja pasar a un participante válido y lo adjunta al request", async () => {
    const participant = { id: "guest", name: "Mica", isOrganizer: false };
    const { guard } = guardWith(participant);
    const context = contextWith(
      { gatheringId: "gathering" },
      { "x-participant-token": TOKEN },
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(context.request).toMatchObject({ participant });
  });

  it("rechaza cuando no hay token", async () => {
    const { guard } = guardWith(null);

    await expect(
      guard.canActivate(contextWith({ gatheringId: "gathering" }, {})),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rechaza un token que no pertenece a la juntada", async () => {
    const { guard } = guardWith(null);

    await expect(
      guard.canActivate(
        contextWith(
          { gatheringId: "gathering" },
          { "x-participant-token": TOKEN },
        ),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("ignora una cabecera repetida en vez de tomar el arreglo como token", async () => {
    const { guard, auth } = guardWith(null);

    await expect(
      guard.canActivate(
        contextWith(
          { gatheringId: "gathering" },
          { "x-participant-token": [TOKEN, "otro"] },
        ),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auth.findByToken).toHaveBeenCalledWith("gathering", undefined);
  });

  it("pide el identificador de la juntada si falta en la ruta", async () => {
    const { guard } = guardWith(null);

    await expect(
      guard.canActivate(contextWith({}, { "x-participant-token": TOKEN })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
