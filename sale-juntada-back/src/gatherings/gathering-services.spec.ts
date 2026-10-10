import { ConflictException, ForbiddenException } from "@nestjs/common";
import { GatheringServiceKey, Prisma } from "@prisma/client";
import { ParticipantAuthService } from "../participants/participant-auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { RsvpService } from "../rsvp/rsvp.service";
import { GatheringsService } from "./gatherings.service";

function setup(disabledServices: GatheringServiceKey[] = []) {
  const gathering = {
    status: "CONFIRMED",
    disabledServices,
    expenseRound: 1,
    participants: [
      { id: "me", name: "Tomy", expensesReadyAt: null as Date | null },
    ],
    expenses: [] as Array<{
      id: string;
      amountCents: number;
      paidByParticipantId: string;
    }>,
    transferConfirmations: [],
    archivedExpenseSettlement: null as unknown,
  };
  const transaction = {
    $queryRaw: jest.fn().mockImplementation(() => Promise.resolve([gathering])),
    gathering: {
      findUnique: jest.fn().mockResolvedValue(gathering),
      update: jest.fn(({ data }) => {
        Object.assign(gathering, data);
        return Promise.resolve({
          disabledServices: gathering.disabledServices,
        });
      }),
    },
  };
  const prisma = {
    ...transaction,
    $transaction: jest.fn((callback) => callback(transaction)),
  } as unknown as PrismaService;
  const auth = {
    requireOrganizer: jest.fn().mockResolvedValue({ id: "me" }),
  } as unknown as ParticipantAuthService;
  const service = new GatheringsService(prisma, auth, {} as RsvpService);
  const set = (key: GatheringServiceKey, enabled: boolean) =>
    service.setGatheringService("g", "me", "token", key, enabled);
  return { service, set, auth, gathering, transaction, prisma };
}

describe("servicios de una juntada", () => {
  it("exige el rol organizador antes de escribir", async () => {
    const { set, auth, prisma } = setup();
    jest
      .mocked(auth.requireOrganizer)
      .mockRejectedValue(new ForbiddenException());
    await expect(set("juegos", false)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it("no permite modificar una juntada cancelada", async () => {
    const { set, gathering, transaction } = setup();
    gathering.status = "CANCELLED";
    await expect(set("juegos", false)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(transaction.gathering.update).not.toHaveBeenCalled();
  });
  it("cambia sólo el servicio solicitado y es idempotente", async () => {
    const { set, gathering, transaction } = setup(["compra"]);
    await set("juegos", false);
    await set("juegos", false);
    expect(transaction.gathering.update).toHaveBeenCalledTimes(1);
    expect(gathering.disabledServices).toEqual(["compra", "juegos"]);
    await set("juegos", true);
    expect(gathering.disabledServices).toEqual(["compra"]);
    expect(transaction.gathering.update.mock.calls[0][0].data).toEqual({
      disabledServices: ["compra", "juegos"],
      archivedExpenseSettlement: undefined,
    });
  });
  it("no archiva gastos sin cerrar aunque nadie deba transferir", async () => {
    const { set, gathering, transaction } = setup();
    gathering.expenses = [
      { id: "expense", paidByParticipantId: "me", amountCents: 5000 },
    ];
    await expect(set("cuentas", false)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(transaction.gathering.update).not.toHaveBeenCalled();
  });
  it("guarda el cierre sin borrar gastos y lo conserva al sumarse otra persona", async () => {
    const { set, gathering, service } = setup();
    gathering.expenses = [
      { id: "expense", paidByParticipantId: "me", amountCents: 5000 },
    ];
    gathering.participants[0].expensesReadyAt = new Date();
    await set("cuentas", false);
    const archive = await service.getExpenseSettlement("g");
    expect(archive.totalCents).toBe(5000);
    gathering.participants.push({
      id: "new",
      name: "Sofi",
      expensesReadyAt: null,
    });
    expect(await service.getExpenseSettlement("g")).toEqual(archive);
    await set("cuentas", true);
    expect(gathering.archivedExpenseSettlement).toBe(Prisma.DbNull);
    expect((await service.getExpenseSettlement("g")).participantCount).toBe(2);
    expect(gathering.expenses).toHaveLength(1);
  });
  it("permite archivar Cuentas vacías sin exigir confirmaciones", async () => {
    const { set, gathering } = setup();
    await set("cuentas", false);
    expect(gathering.disabledServices).toContain("cuentas");
  });
});
