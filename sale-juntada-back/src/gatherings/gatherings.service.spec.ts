import { PrismaService } from "../prisma/prisma.service";
import { GatheringsService, MAX_PARTICIPANTS } from "./gatherings.service";

describe("GatheringsService expense settlement", () => {
  it("divide en partes iguales y genera transferencias directas", async () => {
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
      {
        id: "c",
        name: "Carla",
        createdAt: new Date(),
        expensesReadyAt: null,
        availabilities: [],
      },
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
      {
        id: "c",
        name: "Carla",
        createdAt: new Date(),
        expensesReadyAt: null,
        availabilities: [],
      },
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
    expect(
      result.transfers.reduce((sum, item) => sum + item.amountCents, 0),
    ).toBe(66);
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

describe("GatheringsService dietary profile", () => {
  it("guarda preferencias sólo para el participante dueño del token", async () => {
    const participant = {
      findFirst: jest.fn().mockResolvedValue({
        id: "guest",
        gatheringId: "gathering",
        responseToken: "token",
      }),
      update: jest.fn().mockResolvedValue({
        id: "guest",
        name: "Mica",
        dietaryPreferences: ["CELIAC"],
        mealArrangement: "GROUP_MENU",
      }),
    };
    const service = new GatheringsService({
      participant,
    } as unknown as PrismaService);

    const result = await service.updateDietaryProfile(
      "gathering",
      "guest",
      "token",
      { dietaryPreferences: ["CELIAC"], mealArrangement: "GROUP_MENU" },
    );

    expect(participant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "guest" },
        data: {
          dietaryPreferences: ["CELIAC"],
          mealArrangement: "GROUP_MENU",
        },
      }),
    );
    expect(result.mealArrangement).toBe("GROUP_MENU");
  });

  it("rechaza una necesidad sin indicar cómo se resolverá", async () => {
    const prisma = {
      participant: {
        findFirst: jest.fn().mockResolvedValue({
          id: "guest",
          responseToken: "token",
        }),
      },
    } as unknown as PrismaService;

    await expect(
      new GatheringsService(prisma).updateDietaryProfile(
        "gathering",
        "guest",
        "token",
        { dietaryPreferences: ["VEGAN"] },
      ),
    ).rejects.toThrow("Elegí si vas a gestionar tu comida");
  });
});

describe("GatheringsService purchase plan", () => {
  it("calcula sugerencias según la cantidad actual de participantes", async () => {
    const prisma = {
      gathering: {
        findUnique: jest.fn().mockResolvedValue({
          _count: { participants: 10 },
          purchasePlan: null,
        }),
      },
    } as unknown as PrismaService;
    const service = new GatheringsService(prisma);

    const result = await service.getPurchasePlan("gathering");

    expect(result.persisted).toBe(false);
    expect(result.participantCount).toBe(10);
    expect(result.items.find((item) => item.key === "meat")?.quantity).toBe(1);
    expect(result.items.find((item) => item.key === "snacks")?.label).toBe(
      "Snacks",
    );
  });

  it("impide que una persona invitada edite la compra", async () => {
    const prisma = {
      participant: {
        findFirst: jest.fn().mockResolvedValue({
          id: "guest",
          responseToken: "token",
          isOrganizer: false,
          gathering: { _count: { participants: 6 } },
        }),
      },
    } as unknown as PrismaService;
    const service = new GatheringsService(prisma);

    await expect(
      service.updatePurchasePlan("gathering", "guest", "token", {
        includeAlcohol: false,
        ageConfirmed: false,
        items: [],
      }),
    ).rejects.toThrow("Sólo quien organiza puede editar la compra");
  });

  it("guarda el catálogo validado y la confirmación de adulto", async () => {
    const savedAt = new Date();
    const purchaseItem = { upsert: jest.fn().mockResolvedValue({}) };
    const purchasePlan = {
      upsert: jest.fn().mockResolvedValue({ id: "plan" }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: "plan",
        includeAlcohol: true,
        ageConfirmed: true,
        participantBaseline: 6,
        updatedAt: savedAt,
        items: [
          {
            key: "meat",
            label: "Carne",
            unit: "kg",
            quantity: 4,
            category: "FOOD",
            position: 0,
          },
        ],
      }),
    };
    const prisma = {
      participant: {
        findFirst: jest.fn().mockResolvedValue({
          id: "organizer",
          responseToken: "token",
          isOrganizer: true,
          gathering: { _count: { participants: 6 } },
        }),
      },
      $transaction: jest.fn((callback) =>
        callback({ purchasePlan, purchaseItem }),
      ),
    } as unknown as PrismaService;
    const service = new GatheringsService(prisma);

    const result = await service.updatePurchasePlan(
      "gathering",
      "organizer",
      "token",
      {
        includeAlcohol: true,
        ageConfirmed: true,
        items: [{ key: "meat", quantity: 4 }],
      },
    );

    expect(purchaseItem.upsert).toHaveBeenCalledTimes(9);
    expect(purchasePlan.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ ageConfirmed: true }),
      }),
    );
    expect(result.items.find((item) => item.key === "meat")?.quantity).toBe(4);
  });

  it("asigna un producto libre al participante autenticado", async () => {
    const assignedAt = new Date();
    const purchaseItem = {
      upsert: jest.fn().mockResolvedValue({
        id: "item",
        quantity: 3,
        assignedParticipantId: null,
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn(),
    };
    const purchasePlan = {
      upsert: jest.fn().mockResolvedValue({
        id: "plan",
        includeAlcohol: false,
        ageConfirmed: false,
      }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: "plan",
        includeAlcohol: false,
        ageConfirmed: false,
        participantBaseline: 6,
        updatedAt: assignedAt,
        items: [
          {
            key: "meat",
            label: "Carne",
            unit: "kg",
            quantity: 3,
            category: "FOOD",
            position: 0,
            assignedParticipantId: "guest",
            assignedAt,
            isReady: false,
            assignee: { id: "guest", name: "Mica", avatarUrl: null },
          },
        ],
      }),
    };
    const prisma = {
      participant: {
        findFirst: jest.fn().mockResolvedValue({
          id: "guest",
          name: "Mica",
          responseToken: "token",
          isOrganizer: false,
          gathering: { _count: { participants: 6 } },
        }),
      },
      $transaction: jest.fn((callback) =>
        callback({ purchasePlan, purchaseItem }),
      ),
    } as unknown as PrismaService;

    const result = await new GatheringsService(
      prisma,
    ).updatePurchaseResponsibility("gathering", "guest", "token", "meat", {
      action: "claim",
    });

    expect(purchaseItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "item", assignedParticipantId: null },
        data: expect.objectContaining({ assignedParticipantId: "guest" }),
      }),
    );
    expect(
      result.plan.items.find((item) => item.key === "meat")?.assignedTo,
    ).toEqual({ id: "guest", name: "Mica", avatarUrl: null });
  });

  it("resuelve la carrera cuando otra persona eligió el mismo producto", async () => {
    const purchaseItem = {
      upsert: jest.fn().mockResolvedValue({
        id: "item",
        quantity: 3,
        assignedParticipantId: null,
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        assignedParticipantId: "other",
      }),
    };
    const purchasePlan = {
      upsert: jest.fn().mockResolvedValue({
        id: "plan",
        includeAlcohol: false,
        ageConfirmed: false,
      }),
      findUniqueOrThrow: jest.fn(),
    };
    const prisma = {
      participant: {
        findFirst: jest.fn().mockResolvedValue({
          id: "guest",
          name: "Mica",
          responseToken: "token",
          isOrganizer: false,
          gathering: { _count: { participants: 6 } },
        }),
      },
      $transaction: jest.fn((callback) =>
        callback({ purchasePlan, purchaseItem }),
      ),
    } as unknown as PrismaService;

    await expect(
      new GatheringsService(prisma).updatePurchaseResponsibility(
        "gathering",
        "guest",
        "token",
        "meat",
        { action: "claim" },
      ),
    ).rejects.toThrow("Otra persona acaba de elegir este producto");
  });

  it("guarda un aporte específico sin bloquear la categoría", async () => {
    const transaction = {
      purchasePlan: {
        upsert: jest.fn().mockResolvedValue({
          id: "plan",
          includeAlcohol: false,
          ageConfirmed: false,
        }),
      },
      purchaseItem: {
        upsert: jest.fn().mockResolvedValue({ id: "item" }),
      },
      purchaseContribution: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      participant: {
        findFirst: jest.fn().mockResolvedValue({
          id: "guest",
          name: "Mica",
          responseToken: "token",
          isOrganizer: false,
          gathering: { _count: { participants: 6 } },
        }),
      },
      $transaction: jest.fn((callback) => callback(transaction)),
    } as unknown as PrismaService;
    const service = new GatheringsService(prisma);
    jest.spyOn(service, "getPurchasePlan").mockResolvedValue({} as never);

    await service.upsertPurchaseContribution(
      "gathering",
      "guest",
      "token",
      "soda",
      {
        description: "  Coca-Cola sin azúcar  ",
        quantity: 2,
        unit: " botellas ",
        note: "  bien frías ",
      },
    );

    expect(transaction.purchaseContribution.upsert).toHaveBeenCalledWith({
      where: {
        purchaseItemId_participantId: {
          purchaseItemId: "item",
          participantId: "guest",
        },
      },
      create: expect.objectContaining({
        description: "Coca-Cola sin azúcar",
        quantity: 2,
        unit: "botellas",
        note: "bien frías",
      }),
      update: expect.objectContaining({
        description: "Coca-Cola sin azúcar",
        isReady: false,
      }),
    });
  });

  it("usa el nombre y la presentación canónicos del catálogo", async () => {
    const transaction = {
      purchasePlan: {
        upsert: jest.fn().mockResolvedValue({
          id: "plan",
          includeAlcohol: false,
          ageConfirmed: false,
        }),
      },
      purchaseItem: { upsert: jest.fn().mockResolvedValue({ id: "item" }) },
      purchaseContribution: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      participant: {
        findFirst: jest.fn().mockResolvedValue({
          id: "guest",
          name: "Mica",
          responseToken: "token",
          isOrganizer: false,
          gathering: { _count: { participants: 6 } },
        }),
      },
      catalogProduct: {
        findFirst: jest.fn().mockResolvedValue({
          id: "catalog-soda-cola",
          name: "Gaseosa cola",
        }),
      },
      catalogPresentation: {
        findFirst: jest.fn().mockResolvedValue({
          id: "presentation-soda-cola-2250ml",
          productId: "catalog-soda-cola",
          unit: "botellas de 2,25 L",
        }),
      },
      $transaction: jest.fn((callback) => callback(transaction)),
    } as unknown as PrismaService;
    const service = new GatheringsService(prisma);
    jest.spyOn(service, "getPurchasePlan").mockResolvedValue({} as never);

    await service.upsertPurchaseContribution(
      "gathering",
      "guest",
      "token",
      "soda",
      {
        catalogProductId: "catalog-soda-cola",
        catalogPresentationId: "presentation-soda-cola-2250ml",
        description: "nombre manipulado",
        quantity: 2,
        unit: "unidad manipulada",
      },
    );

    expect(transaction.purchaseContribution.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          catalogProductId: "catalog-soda-cola",
          catalogPresentationId: "presentation-soda-cola-2250ml",
          description: "Gaseosa cola",
          unit: "botellas de 2,25 L",
        }),
      }),
    );
  });

  it("rechaza un producto de otra categoría", async () => {
    const prisma = {
      participant: {
        findFirst: jest.fn().mockResolvedValue({
          id: "guest",
          name: "Mica",
          responseToken: "token",
          isOrganizer: false,
          gathering: { _count: { participants: 6 } },
        }),
      },
      catalogProduct: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;

    await expect(
      new GatheringsService(prisma).upsertPurchaseContribution(
        "gathering",
        "guest",
        "token",
        "snacks",
        {
          catalogProductId: "catalog-alcohol-beer",
          catalogPresentationId: "presentation-alcohol-beer-can",
          quantity: 1,
        },
      ),
    ).rejects.toThrow("Ese producto no pertenece a esta categoría");
  });
});

describe("GatheringsService authenticated history", () => {
  const input = {
    title: "Asado del sábado",
    organizerName: "Tomy",
    windowStart: "2026-09-05T19:00:00.000Z",
    windowEnd: "2026-09-07T02:00:00.000Z",
    durationMinutes: 180,
    dailyStartMinutes: 1140,
    dailyEndMinutes: 1560,
    slotStepMinutes: 60,
  };

  it("vincula al organizador cuando crea con una sesión válida", async () => {
    const created = { id: "new", participants: [] };
    const transaction = {
      gathering: { create: jest.fn().mockResolvedValue(created) },
      purchasePlan: { create: jest.fn() },
      userPaymentProfile: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(transaction)),
    } as unknown as PrismaService;

    const result = await new GatheringsService(prisma).create(input, {
      id: "auth-user",
      email: "tomy@example.com",
    });

    expect(result).toBe(created);
    expect(transaction.gathering.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          participants: {
            create: expect.objectContaining({
              authUserId: "auth-user",
              contact: "tomy@example.com",
              isOrganizer: true,
            }),
          },
        }),
      }),
    );
  });

  it("duplica cantidades pero reinicia personas, responsables y alcohol", async () => {
    const created = { id: "copy", participants: [] };
    const transaction = {
      gathering: {
        findFirst: jest.fn().mockResolvedValue({
          description: "Una descripción",
          purchasePlan: {
            participantBaseline: 8,
            items: [
              {
                key: "soda",
                label: "Gaseosas",
                unit: "botellas",
                quantity: 4,
                category: "DRINKS",
                position: 0,
              },
            ],
          },
        }),
        create: jest.fn().mockResolvedValue(created),
      },
      purchasePlan: { create: jest.fn().mockResolvedValue({}) },
      userPaymentProfile: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(transaction)),
    } as unknown as PrismaService;

    await new GatheringsService(prisma).create(
      { ...input, templateGatheringId: "old" },
      { id: "auth-user", email: "tomy@example.com" },
    );

    expect(transaction.gathering.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "old",
          participants: {
            some: { authUserId: "auth-user", isOrganizer: true },
          },
        }),
      }),
    );
    expect(transaction.purchasePlan.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gatheringId: "copy",
        includeAlcohol: false,
        ageConfirmed: false,
        items: {
          create: [expect.objectContaining({ key: "soda", quantity: 4 })],
        },
      }),
    });
  });
});

describe("GatheringsService payment aliases", () => {
  it("normaliza y sincroniza el alias de un usuario autenticado", async () => {
    const transaction = {
      userPaymentProfile: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      participant: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        update: jest.fn(),
      },
    };
    const prisma = {
      participant: {
        findFirst: jest.fn().mockResolvedValue({
          id: "participant",
          name: "Tomy",
          authUserId: "auth-user",
          responseToken: "token",
        }),
      },
      $transaction: jest.fn((callback) => callback(transaction)),
    } as unknown as PrismaService;

    const result = await new GatheringsService(prisma).updatePaymentAlias(
      "gathering",
      "participant",
      "token",
      { paymentAlias: "  MATE.Asado-26  " },
      { id: "auth-user", email: "tomy@example.com" },
    );

    expect(result.paymentAlias).toBe("mate.asado-26");
    expect(transaction.userPaymentProfile.upsert).toHaveBeenCalledWith({
      where: { authUserId: "auth-user" },
      create: { authUserId: "auth-user", paymentAlias: "mate.asado-26" },
      update: { paymentAlias: "mate.asado-26" },
    });
    expect(transaction.participant.updateMany).toHaveBeenCalledWith({
      where: { authUserId: "auth-user" },
      data: { paymentAlias: "mate.asado-26" },
    });
  });

  it("sólo entrega el alias del destinatario al participante que debe pagarle", async () => {
    const participants = [
      {
        id: "payer",
        name: "Ana",
        createdAt: new Date("2026-08-01"),
        expensesReadyAt: new Date(),
      },
      {
        id: "recipient",
        name: "Beto",
        createdAt: new Date("2026-08-02"),
        expensesReadyAt: new Date(),
      },
    ];
    const prisma = {
      participant: {
        findFirst: jest.fn().mockResolvedValue({
          id: "payer",
          paymentAlias: null,
          responseToken: "token",
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: "recipient",
            name: "Beto",
            paymentAlias: "beto.asado",
          },
        ]),
      },
      gathering: {
        findUnique: jest.fn().mockResolvedValue({
          participants,
          expenses: [
            {
              id: "expense",
              paidByParticipantId: "recipient",
              amountCents: 10_000,
              paidBy: { id: "recipient", name: "Beto" },
            },
          ],
          expenseRound: 1,
          transferConfirmations: [],
        }),
      },
    } as unknown as PrismaService;

    const result = await new GatheringsService(prisma).getPaymentDetails(
      "gathering",
      "payer",
      "token",
    );

    expect(result.recipients).toEqual([
      {
        participantId: "recipient",
        name: "Beto",
        paymentAlias: "beto.asado",
      },
    ]);
    expect(prisma.participant.findMany).toHaveBeenCalledWith({
      where: { gatheringId: "gathering", id: { in: ["recipient"] } },
      select: { id: true, name: true, paymentAlias: true },
    });
  });
});

describe("GatheringsService lifecycle", () => {
  const gathering = {
    id: "gathering",
    slug: "asado-demo",
    title: "Asado demo",
    status: "OPEN",
    locationHint: "Yerba Buena",
    locationLatitude: null,
    locationLongitude: null,
    windowStart: new Date("2026-08-20T22:00:00.000Z"),
    windowEnd: new Date("2026-08-23T05:00:00.000Z"),
    durationMinutes: 180,
    dailyStartMinutes: 1140,
    dailyEndMinutes: 1560,
    slotStepMinutes: 60,
  };

  it("persiste la fecha elegida sólo para el organizador", async () => {
    const prisma = {
      participant: {
        findFirst: jest.fn().mockResolvedValue({
          id: "organizer",
          isOrganizer: true,
          responseToken: "secret",
          gathering,
        }),
      },
      gathering: {
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({
          ...gathering,
          status: "CONFIRMED",
          finalizedStart: new Date("2026-08-21T00:00:00.000Z"),
          finalizedEnd: new Date("2026-08-21T03:00:00.000Z"),
          participants: [],
          proposals: [],
        }),
      },
    } as unknown as PrismaService;

    const result = await new GatheringsService(prisma).finalizeGathering(
      "gathering",
      "organizer",
      "secret",
      {
        startsAt: "2026-08-21T00:00:00.000Z",
        endsAt: "2026-08-21T03:00:00.000Z",
        location: "Yerba Buena",
      },
    );

    expect(result.status).toBe("CONFIRMED");
    expect(prisma.gathering.update).toHaveBeenCalledWith({
      where: { id: "gathering" },
      data: expect.objectContaining({
        status: "CONFIRMED",
        finalizedLocation: "Yerba Buena",
      }),
    });
  });

  it("borra disponibilidades cuando cambia el rango", async () => {
    const transaction = {
      availability: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
      proposal: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      gathering: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      participant: {
        findFirst: jest.fn().mockResolvedValue({
          id: "organizer",
          isOrganizer: true,
          responseToken: "secret",
          gathering,
        }),
      },
      gathering: {
        findUnique: jest.fn().mockResolvedValue({
          ...gathering,
          participants: [],
          proposals: [],
        }),
      },
      $transaction: jest.fn((callback) => callback(transaction)),
    } as unknown as PrismaService;

    await new GatheringsService(prisma).updateGathering(
      "gathering",
      "organizer",
      "secret",
      {
        windowStart: "2026-08-24T22:00:00.000Z",
        windowEnd: "2026-08-27T05:00:00.000Z",
      },
    );

    expect(transaction.availability.deleteMany).toHaveBeenCalledWith({
      where: { participant: { gatheringId: "gathering" } },
    });
    expect(transaction.gathering.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "OPEN",
          finalizedStart: null,
        }),
      }),
    );
  });
});

describe("GatheringsService expense corrections", () => {
  it("permite al pagador corregir un gasto y reabre las confirmaciones", async () => {
    const transaction = {
      gathering: {
        findUnique: jest.fn().mockResolvedValue({
          participants: [{ expensesReadyAt: new Date() }],
          _count: { expenses: 1 },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      participant: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      expense: {
        update: jest.fn().mockResolvedValue({
          id: "expense",
          description: "Bebidas",
          amountCents: 12_000,
          paidBy: { id: "participant", name: "Sofi" },
        }),
      },
    };
    const prisma = {
      participant: {
        findFirst: jest.fn().mockResolvedValue({
          id: "participant",
          name: "Sofi",
          isOrganizer: false,
          responseToken: "secret",
          gathering: { status: "OPEN" },
        }),
      },
      expense: {
        findFirst: jest.fn().mockResolvedValue({
          id: "expense",
          paidByParticipantId: "participant",
        }),
      },
      $transaction: jest.fn((callback) => callback(transaction)),
    } as unknown as PrismaService;

    const result = await new GatheringsService(prisma).updateExpense(
      "gathering",
      "participant",
      "secret",
      "expense",
      { description: "Bebidas", amountCents: 12_000 },
    );

    expect(result.expense.amountCents).toBe(12_000);
    expect(transaction.participant.updateMany).toHaveBeenCalledWith({
      where: { gatheringId: "gathering" },
      data: { expensesReadyAt: null },
    });
  });
});

describe("GatheringsService transfer confirmations", () => {
  it("guarda cada confirmación contra su ronda de gastos", async () => {
    const participants = [
      {
        id: "a",
        name: "Ana",
        createdAt: new Date(),
        expensesReadyAt: new Date(),
        availabilities: [],
      },
      {
        id: "b",
        name: "Beto",
        createdAt: new Date(),
        expensesReadyAt: new Date(),
        availabilities: [],
      },
    ];
    const upsert = jest.fn().mockResolvedValue({
      fromParticipant: { id: "a", name: "Ana" },
      toParticipant: { id: "b", name: "Beto" },
    });
    const prisma = {
      participant: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: "a", responseToken: "token-ana" }),
      },
      gathering: {
        findUnique: jest.fn().mockResolvedValue({
          participants,
          expenses: [
            {
              id: "expense-b",
              paidByParticipantId: "b",
              amountCents: 12_000,
              paidBy: { id: "b", name: "Beto" },
            },
          ],
          // Segunda ronda: ya hubo un pago de 6.000 de Ana a Beto antes.
          expenseRound: 2,
          transferConfirmations: [],
        }),
      },
      transferConfirmation: { upsert },
    } as unknown as PrismaService;

    await new GatheringsService(prisma).confirmTransfer(
      "gathering",
      "a",
      "token-ana",
      { toParticipantId: "b", amountCents: 6_000 },
    );

    // La clave incluye la ronda: un segundo pago del mismo monto entre las
    // mismas dos personas ya no pisa al de la ronda anterior.
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0].where).toEqual({
      roundPair: {
        gatheringId: "gathering",
        expenseRound: 2,
        fromParticipantId: "a",
        toParticipantId: "b",
      },
    });
  });
});

describe("GatheringsService addParticipant", () => {
  const gathering = {
    id: "gathering",
    status: "OPEN",
  };

  it("frena un nombre repetido para no alterar la división de gastos", async () => {
    const create = jest.fn();
    const prisma = {
      gathering: { findUnique: jest.fn().mockResolvedValue(gathering) },
      participant: {
        findFirst: jest.fn().mockResolvedValue({ id: "existing" }),
        create,
      },
    } as unknown as PrismaService;

    await expect(
      new GatheringsService(prisma).addParticipant("gathering", {
        name: "Sofi",
      }),
    ).rejects.toThrow(/Ya hay alguien anotado/);
    expect(create).not.toHaveBeenCalled();
  });

  it("compara nombres sin distinguir mayúsculas ni espacios de borde", async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = {
      gathering: { findUnique: jest.fn().mockResolvedValue(gathering) },
      participant: {
        findFirst,
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: "new", name: "sofi" }),
      },
    } as unknown as PrismaService;

    await new GatheringsService(prisma).addParticipant("gathering", {
      name: "  sofi  ",
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        gatheringId: "gathering",
        name: { equals: "sofi", mode: "insensitive" },
      },
      select: { id: true },
    });
  });

  it("deja entrar al duplicado si la persona ya confirmó que es otra", async () => {
    const create = jest.fn().mockResolvedValue({ id: "new", name: "Sofi" });
    const prisma = {
      gathering: { findUnique: jest.fn().mockResolvedValue(gathering) },
      participant: {
        findFirst: jest.fn().mockResolvedValue({ id: "existing" }),
        count: jest.fn().mockResolvedValue(0),
        create,
      },
    } as unknown as PrismaService;

    await new GatheringsService(prisma).addParticipant("gathering", {
      name: "Sofi",
      allowDuplicateName: true,
    });

    expect(create).toHaveBeenCalledTimes(1);
  });

  it("no deja sumar más gente cuando la juntada llegó al tope", async () => {
    const create = jest.fn();
    const prisma = {
      gathering: { findUnique: jest.fn().mockResolvedValue(gathering) },
      participant: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(MAX_PARTICIPANTS),
        create,
      },
    } as unknown as PrismaService;

    await expect(
      new GatheringsService(prisma).addParticipant("gathering", {
        name: "Alguien más",
      }),
    ).rejects.toThrow(/llegó al máximo/);
    expect(create).not.toHaveBeenCalled();
  });
});
