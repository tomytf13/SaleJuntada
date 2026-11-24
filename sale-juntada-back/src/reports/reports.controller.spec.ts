import { ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SupabaseAuthService } from "../auth/supabase-auth.service";
import { ReportsController } from "./reports.controller";

function setup(isAppAdmin: boolean) {
  const reports = {
    findMany: jest.fn(),
    updateMany: jest.fn(),
    createMany: jest.fn(),
  };
  const auth = {
    requireIdentity: jest.fn().mockResolvedValue({ id: "me", isAppAdmin }),
  };
  const controller = new ReportsController(
    { appReport: reports } as unknown as PrismaService,
    auth as unknown as SupabaseAuthService,
  );
  return { controller, reports, auth };
}

describe("reportes de la aplicación", () => {
  it("permite enviar sin iniciar sesión y reintentar sin duplicar", async () => {
    const { controller, reports, auth } = setup(false);
    const input = {
      id: "a",
      kind: "BUG" as const,
      description: "No se carga el mapa",
    };
    await expect(controller.create(input)).resolves.toEqual({ id: "a" });
    expect(auth.requireIdentity).not.toHaveBeenCalled();
    expect(reports.createMany).toHaveBeenCalledWith({
      data: [input],
      skipDuplicates: true,
    });
  });
  it("protege lectura y cambios aunque sea una cuenta de la app", async () => {
    const { controller, reports } = setup(false);
    await expect(controller.list("Bearer test", "NEW")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      controller.update("Bearer test", "some-id", { status: "RESOLVED" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(reports.findMany).not.toHaveBeenCalled();
    expect(reports.updateMany).not.toHaveBeenCalled();
  });
});
