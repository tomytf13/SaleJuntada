import { ConflictException, NotFoundException } from "@nestjs/common";
import { GatheringServiceKey } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { withActiveGatheringService } from "./gathering-service-access";

function setup(
  state: { status: string; disabledServices: GatheringServiceKey[] } | null,
) {
  const transaction = {
    $queryRaw: jest.fn().mockResolvedValue(state ? [state] : []),
  };
  const prisma = {
    $transaction: jest.fn((callback) => callback(transaction)),
  } as unknown as PrismaService;
  const write = jest.fn().mockResolvedValue("saved");
  return { prisma, write, transaction };
}

describe("escrituras de servicios", () => {
  it.each<GatheringServiceKey>([
    "compra",
    "pendientes",
    "alimentacion",
    "cuentas",
  ])("bloquea %s cuando está archivado", async (service) => {
    const { prisma, write } = setup({
      status: "CONFIRMED",
      disabledServices: [service],
    });
    await expect(
      withActiveGatheringService(prisma, "g", service, write),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(write).not.toHaveBeenCalled();
  });
  it("permite otro servicio activo dentro de la transacción", async () => {
    const { prisma, write, transaction } = setup({
      status: "OPEN",
      disabledServices: ["juegos"],
    });
    await expect(
      withActiveGatheringService(prisma, "g", "pendientes", write),
    ).resolves.toBe("saved");
    expect(write).toHaveBeenCalledWith(transaction);
    expect(transaction.$queryRaw.mock.calls[0][1]).toBe("g");
  });
  it.each([null, { status: "CANCELLED", disabledServices: [] }])(
    "rechaza una juntada inexistente o cancelada",
    async (state) => {
      const { prisma, write } = setup(state);
      await expect(
        withActiveGatheringService(prisma, "g", "cuentas", write),
      ).rejects.toBeInstanceOf(state ? ConflictException : NotFoundException);
      expect(write).not.toHaveBeenCalled();
    },
  );
});
