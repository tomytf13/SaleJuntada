import { ExecutionContext } from "@nestjs/common";
import { GatheringAccountGuard } from "./gathering-account.guard";
import { SupabaseAuthService } from "../auth/supabase-auth.service";
import { PrismaService } from "../prisma/prisma.service";

function setup(
  action: string,
  headers: Record<string, string> = {},
  owner: string | null = "me",
) {
  const auth = { requireIdentity: jest.fn().mockResolvedValue({ id: "me" }) };
  const prisma = {
    participant: {
      findUnique: jest.fn().mockResolvedValue({ authUserId: owner }),
    },
  };
  const request = { headers };
  const context = {
    getHandler: () => ({ name: action }),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const guard = new GatheringAccountGuard(
    auth as unknown as SupabaseAuthService,
    prisma as unknown as PrismaService,
  );
  return { guard, context, request, auth };
}

describe("cuenta obligatoria", () => {
  it.each([
    "create",
    "addParticipant",
    "addAuthenticatedParticipant",
    "setRsvp",
    "setAvailability",
    "getMatches",
    "setService",
  ])("rechaza %s sin login aunque conserve token antiguo", async (action) => {
    const { guard, context } = setup(action, {
      "x-participant-token": "legacy",
    });
    await expect(guard.canActivate(context)).rejects.toThrow(/Ingresá/);
  });
  it("sólo muestra la invitación pública sin sesión", async () => {
    const { guard, context, request, auth } = setup("getBySlug", {
      "x-participant-token": "legacy",
    });
    expect(await guard.canActivate(context)).toBe(true);
    expect(request.headers["x-participant-token"]).toBeUndefined();
    expect(auth.requireIdentity).not.toHaveBeenCalled();
  });
  it("rechaza una cuenta ajena aunque tenga el token del participante", async () => {
    const { guard, context } = setup(
      "setRsvp",
      { authorization: "Bearer valid", "x-participant-token": "other" },
      "someone-else",
    );
    await expect(guard.canActivate(context)).rejects.toThrow(/no pertenece/);
  });
  it("permite actuar con sesión y participación de la misma cuenta", async () => {
    const { guard, context } = setup("setRsvp", {
      authorization: "Bearer valid",
      "x-participant-token": "mine",
    });
    expect(await guard.canActivate(context)).toBe(true);
  });
  it("permite vincular un acceso antiguo sólo después de ingresar", async () => {
    const { guard, context } = setup(
      "linkAuthenticatedParticipant",
      { authorization: "Bearer valid", "x-participant-token": "legacy" },
      null,
    );
    expect(await guard.canActivate(context)).toBe(true);
  });
  it("no permite reasignar una participación vinculada", async () => {
    const { guard, context } = setup(
      "linkAuthenticatedParticipant",
      { authorization: "Bearer valid", "x-participant-token": "other" },
      "someone-else",
    );
    await expect(guard.canActivate(context)).rejects.toThrow(/no pertenece/);
  });
  it("rechaza sesiones inválidas", async () => {
    const { guard, context, auth } = setup("addAuthenticatedParticipant", {
      authorization: "Bearer invalid",
    });
    auth.requireIdentity.mockRejectedValue(new Error("sesión vencida"));
    await expect(guard.canActivate(context)).rejects.toThrow(/vencida/);
  });
});
