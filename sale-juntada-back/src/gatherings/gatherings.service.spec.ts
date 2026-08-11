import { PrismaService } from "../prisma/prisma.service";
import { GatheringsService } from "./gatherings.service";

describe("GatheringsService expense settlement", () => {
  it("divide en partes iguales y genera transferencias directas", async () => {
    const participants = [
      { id: "a", name: "Ana", createdAt: new Date(), expensesReadyAt: null, availabilities: [] },
      { id: "b", name: "Beto", createdAt: new Date(), expensesReadyAt: null, availabilities: [] },
      { id: "c", name: "Carla", createdAt: new Date(), expensesReadyAt: null, availabilities: [] },
    ];
    const expenses = [
      {
        id: "expense-a",
        paidByParticipantId: "a",
        amountCents: 12_000,
        paidBy: { id: "a", name: "Ana" },
      },
      {
        id: "expense-b",
        paidByParticipantId: "b",
        amountCents: 6_000,
        paidBy: { id: "b", name: "Beto" },
      },
    ];
    const prisma = {
      gathering: {
        findUnique: jest.fn().mockResolvedValue({
          participants,
          expenses,
          expenseRound: 1,
          transferConfirmations: [],
        }),
      },
    } as unknown as PrismaService;
    const service = new GatheringsService(prisma);

    const result = await service.getExpenseSettlement("gathering");

    expect(result.totalCents).toBe(18_000);
    expect(result.averageCents).toBe(6_000);
    expect(result.transfers).toEqual([
      {
        id: "c:a:6000",
        fromParticipantId: "c",
        fromName: "Carla",
        toParticipantId: "a",
        toName: "Ana",
        amountCents: 6_000,
        settled: false,
      },
    ]);
  });

  it("reparte los centavos sin perder ni crear dinero", async () => {
    const participants = [
      { id: "a", name: "Ana", createdAt: new Date(), expensesReadyAt: null, availabilities: [] },
      { id: "b", name: "Beto", createdAt: new Date(), expensesReadyAt: null, availabilities: [] },
      { id: "c", name: "Carla", createdAt: new Date(), expensesReadyAt: null, availabilities: [] },
    ];
    const expenses = [
      {
        id: "expense-a",
        paidByParticipantId: "a",
        amountCents: 100,
        paidBy: { id: "a", name: "Ana" },
      },
    ];
    const prisma = {
      gathering: {
        findUnique: jest.fn().mockResolvedValue({
          participants,
          expenses,
          expenseRound: 1,
          transferConfirmations: [],
        }),
      },
    } as unknown as PrismaService;
    const service = new GatheringsService(prisma);

    const result = await service.getExpenseSettlement("gathering");

    expect(result.balances.reduce((sum, item) => sum + item.owedCents, 0)).toBe(
      100,
    );
    expect(result.transfers.reduce((sum, item) => sum + item.amountCents, 0)).toBe(
      66,
    );
  });

  it("calcula solo el ajuste cuando ya hubo una transferencia", async () => {
    const participants = [
      {
        id: "a",
        name: "Ana",
        createdAt: new Date(),
        expensesReadyAt: null,
        availabilities: [],
      },
      {
        id: "b",
        name: "Beto",
        createdAt: new Date(),
        expensesReadyAt: null,
        availabilities: [],
      },
    ];
    const expenses = [
      {
        id: "expense-a",
        paidByParticipantId: "a",
        amountCents: 10_000,
        paidBy: { id: "a", name: "Ana" },
      },
      {
        id: "expense-b",
        paidByParticipantId: "b",
        amountCents: 2_000,
        paidBy: { id: "b", name: "Beto" },
      },
    ];
    const prisma = {
      gathering: {
        findUnique: jest.fn().mockResolvedValue({
          participants,
          expenses,
          expenseRound: 2,
          transferConfirmations: [
            {
              id: "paid-1",
              fromParticipantId: "b",
              toParticipantId: "a",
              amountCents: 5_000,
              confirmedAt: new Date(),
            },
          ],
        }),
      },
    } as unknown as PrismaService;
    const service = new GatheringsService(prisma);

    const result = await service.getExpenseSettlement("gathering");

    expect(result.expenseRound).toBe(2);
    expect(result.completedTransfers).toHaveLength(1);
    expect(result.transfers).toEqual([
      {
        id: "a:b:1000",
        fromParticipantId: "a",
        fromName: "Ana",
        toParticipantId: "b",
        toName: "Beto",
        amountCents: 1_000,
        settled: false,
      },
    ]);
  });
});
