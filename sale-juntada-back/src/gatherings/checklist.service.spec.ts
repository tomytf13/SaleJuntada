import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { ChecklistService } from "./checklist.service";
import { PrismaService } from "../prisma/prisma.service";
import { ParticipantAuthService } from "../participants/participant-auth.service";

function setup(
  isOrganizer = false,
  assignedParticipantId: string | null = null,
  isReady = false,
) {
  const item = {
    id: "item",
    gatheringId: "gathering",
    label: "Carbón",
    assignedParticipantId,
    isReady,
  };
  const transaction = {
    $queryRaw: jest
      .fn()
      .mockResolvedValue([{ status: "CONFIRMED", disabledServices: [] }]),
    checklistItem: {
      create: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest.fn().mockResolvedValue(item),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(item),
    },
    participant: { findFirst: jest.fn().mockResolvedValue({ id: "friend" }) },
  };
  const prisma = {
    $transaction: jest
      .fn()
      .mockImplementation((callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    checklistItem: transaction.checklistItem,
  };
  const auth = {
    requireActiveParticipant: jest
      .fn()
      .mockResolvedValue({ id: "me", isOrganizer }),
  };
  const service = new ChecklistService(
    prisma as unknown as PrismaService,
    auth as unknown as ParticipantAuthService,
  );
  return { service, prisma, auth, transaction };
}

describe("ChecklistService", () => {
  it("exige acceso activo antes de agregar una necesidad", async () => {
    const { service, auth, prisma } = setup();
    auth.requireActiveParticipant.mockRejectedValue(
      new UnauthorizedException(),
    );
    await expect(
      service.create("gathering", "me", "bad-token", { label: "Carbón" }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.checklistItem.create).not.toHaveBeenCalled();
  });

  it("rechaza cambios si la juntada está cancelada", async () => {
    const { service, auth, prisma } = setup();
    auth.requireActiveParticipant.mockRejectedValue(
      new ConflictException("La juntada está cancelada"),
    );
    await expect(
      service.update("gathering", "me", "token", "item", { action: "claim" }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("permite anotarse en una necesidad sin dueño", async () => {
    const { service, transaction } = setup();
    await service.update("gathering", "me", "token", "item", {
      action: "claim",
    });
    expect(transaction.checklistItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ assignedParticipantId: null }),
        data: { assignedParticipantId: "me", isReady: false },
      }),
    );
  });

  it("no permite tomar la tarea de otra persona", async () => {
    const { service, transaction } = setup(false, "friend");
    await expect(
      service.update("gathering", "me", "token", "item", { action: "claim" }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.checklistItem.updateMany).not.toHaveBeenCalled();
  });

  it("detecta que otra persona tomó la tarea durante el pedido", async () => {
    const { service, transaction } = setup();
    transaction.checklistItem.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.update("gathering", "me", "token", "item", { action: "claim" }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("los invitados no pueden asignar tareas a otros", async () => {
    const { service } = setup();
    await expect(
      service.update("gathering", "me", "token", "item", {
        action: "assign",
        assignedParticipantId: "friend",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("el organizador puede asignar y el cambio de dueño vuelve a pendiente", async () => {
    const { service, transaction } = setup(true, "me", true);
    await service.update("gathering", "me", "token", "item", {
      action: "assign",
      assignedParticipantId: "friend",
    });
    expect(transaction.checklistItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { assignedParticipantId: "friend", isReady: false },
      }),
    );
    expect(transaction.participant.findFirst).toHaveBeenCalledWith({
      where: { id: "friend", gatheringId: "gathering" },
    });
  });

  it("no asigna responsables de otra juntada", async () => {
    const { service, transaction } = setup(true);
    transaction.participant.findFirst.mockResolvedValue(null as never);
    await expect(
      service.update("gathering", "me", "token", "item", {
        action: "assign",
        assignedParticipantId: "stranger",
      }),
    ).rejects.toThrow("El responsable debe ser parte de esta juntada");
    expect(transaction.checklistItem.updateMany).not.toHaveBeenCalled();
  });

  it("no expone ni modifica tareas de otra juntada", async () => {
    const { service, transaction } = setup(true);
    transaction.checklistItem.findFirst.mockResolvedValue(null as never);
    await expect(
      service.update("other-gathering", "me", "token", "item", {
        action: "ready",
      }),
    ).rejects.toThrow("No encontramos esa necesidad");
    expect(transaction.checklistItem.findFirst).toHaveBeenCalledWith({
      where: { id: "item", gatheringId: "other-gathering" },
    });
  });

  it("sólo el responsable o el organizador marca listo o libera", async () => {
    const { service } = setup(false, "friend");
    for (const action of ["ready", "pending", "release"] as const) {
      await expect(
        service.update("gathering", "me", "token", "item", { action }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
  });

  it("no marca listo algo sin responsable", async () => {
    const { service } = setup(true);
    await expect(
      service.update("gathering", "me", "token", "item", { action: "ready" }),
    ).rejects.toThrow("Primero hace falta un responsable");
  });

  it("el responsable puede marcar listo y al liberar se borra esa marca", async () => {
    const { service, transaction } = setup(false, "me", true);
    await service.update("gathering", "me", "token", "item", {
      action: "release",
    });
    expect(transaction.checklistItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { assignedParticipantId: null, isReady: false },
      }),
    );
  });

  it("sólo el organizador puede quitar necesidades", async () => {
    const { service, prisma } = setup(false);
    await expect(
      service.remove("gathering", "me", "token", "item"),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.checklistItem.deleteMany).not.toHaveBeenCalled();
  });
});
