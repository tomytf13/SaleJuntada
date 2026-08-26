import { Prisma } from "@prisma/client";
import { ParticipantAuthService } from "../participants/participant-auth.service";
import { RsvpService } from "../rsvp/rsvp.service";
import { generateParticipantToken } from "../participants/participant-token";
import { PrismaService } from "../prisma/prisma.service";
import { GatheringsService } from "./gatherings.service";

const TOKEN = generateParticipantToken();

/**
 * Prisma en memoria con el comportamiento que importa acá: el índice único
 * `(gatheringId, idempotencyKey)`. Es la única garantía real de
 * idempotencia —el chequeo previo del servicio sólo evita trabajo— así que
 * el doble tiene que reproducirlo, incluido el rollback de la transacción
 * cuando el insert es rechazado.
 */
function buildPrisma() {
  const expenses: Array<{
    id: string;
    gatheringId: string;
    idempotencyKey: string;
    description: string;
    amountCents: number;
    paidByParticipantId: string;
    paidBy: { id: string; name: string; avatarUrl: null };
  }> = [];
  const state = { expenseRound: 1, nextId: 1 };

  const client = {
    participant: {
      findFirst: jest.fn().mockResolvedValue({
        id: "guest",
        gatheringId: "gathering",
        name: "Mica",
        isOrganizer: false,
        responseToken: TOKEN,
        gathering: { id: "gathering", slug: "asado", status: "OPEN" },
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    gathering: {
      findUnique: jest.fn().mockResolvedValue({
        participants: [{ expensesReadyAt: new Date() }],
        _count: { expenses: 1 },
      }),
      update: jest.fn(() => {
        state.expenseRound += 1;
        return Promise.resolve({ expenseRound: state.expenseRound });
      }),
    },
    expense: {
      findUnique: jest.fn(
        ({
          where,
        }: {
          where: { gatheringId_idempotencyKey: { gatheringId: string; idempotencyKey: string } };
        }) => {
          const { gatheringId, idempotencyKey } = where.gatheringId_idempotencyKey;
          return Promise.resolve(
            expenses.find(
              (expense) =>
                expense.gatheringId === gatheringId &&
                expense.idempotencyKey === idempotencyKey,
            ) ?? null,
          );
        },
      ),
      create: jest.fn(({ data }: { data: Record<string, string | number> }) => {
        const duplicated = expenses.some(
          (expense) =>
            expense.gatheringId === data.gatheringId &&
            expense.idempotencyKey === data.idempotencyKey,
        );
        if (duplicated) {
          return Promise.reject(
            new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
              code: "P2002",
              clientVersion: "test",
            }),
          );
        }
        const created = {
          id: `expense-${state.nextId++}`,
          gatheringId: String(data.gatheringId),
          idempotencyKey: String(data.idempotencyKey),
          description: String(data.description),
          amountCents: Number(data.amountCents),
          paidByParticipantId: String(data.paidByParticipantId),
          paidBy: { id: "guest", name: "Mica", avatarUrl: null },
        };
        expenses.push(created);
        return Promise.resolve(created);
      }),
    },
  };

  // Se adjunta después de construir `client` porque el callback lo recibe
  // como cliente transaccional y anotarlo dentro del literal sería una
  // referencia circular.
  //
  // Transacción interactiva con rollback. Deshace sólo lo que escribió
  // *esta* transacción: con dos requests en vuelo, revertir a un valor
  // absoluto pisaría lo que ya confirmó la otra, que es justamente lo que
  // una base real no hace.
  const $transaction = jest.fn(
    async (callback: (tx: unknown) => Promise<unknown>) => {
      const createdHere: string[] = [];
      let incrementsHere = 0;

      const scoped = {
        ...client,
        gathering: {
          ...client.gathering,
          update: jest.fn(() => {
            incrementsHere += 1;
            state.expenseRound += 1;
            return Promise.resolve({ expenseRound: state.expenseRound });
          }),
        },
        expense: {
          ...client.expense,
          create: async (args: { data: Record<string, string | number> }) => {
            const created = await client.expense.create(args);
            createdHere.push(created.id);
            return created;
          },
        },
      };

      try {
        return await callback(scoped);
      } catch (error) {
        state.expenseRound -= incrementsHere;
        for (const id of createdHere) {
          const index = expenses.findIndex((expense) => expense.id === id);
          if (index >= 0) expenses.splice(index, 1);
        }
        throw error;
      }
    },
  );

  return {
    client: { ...client, $transaction } as unknown as PrismaService,
    expenses,
    state,
  };
}

function buildService(prisma: PrismaService) {
  return new GatheringsService(prisma, new ParticipantAuthService(prisma), new RsvpService(prisma, new ParticipantAuthService(prisma)));
}

const payload = { description: "Carne", amountCents: 42_000 };

describe("addExpense idempotencia", () => {
  it("un request crea un gasto", async () => {
    const { client, expenses } = buildPrisma();

    await buildService(client).addExpense(
      "gathering",
      "guest",
      TOKEN,
      "key-1",
      payload,
    );

    expect(expenses).toHaveLength(1);
  });

  it("la misma clave dos veces devuelve el mismo gasto y no crea otro", async () => {
    const { client, expenses } = buildPrisma();
    const service = buildService(client);

    const first = await service.addExpense(
      "gathering",
      "guest",
      TOKEN,
      "key-1",
      payload,
    );
    const retry = await service.addExpense(
      "gathering",
      "guest",
      TOKEN,
      "key-1",
      payload,
    );

    expect(expenses).toHaveLength(1);
    expect(retry.id).toBe(first.id);
  });

  it("claves distintas crean gastos distintos", async () => {
    const { client, expenses } = buildPrisma();
    const service = buildService(client);

    await service.addExpense("gathering", "guest", TOKEN, "key-1", payload);
    await service.addExpense("gathering", "guest", TOKEN, "key-2", payload);

    expect(expenses).toHaveLength(2);
  });

  it("dos requests concurrentes con la misma clave crean un solo gasto", async () => {
    const { client, expenses } = buildPrisma();
    const service = buildService(client);

    const [first, second] = await Promise.all([
      service.addExpense("gathering", "guest", TOKEN, "key-1", payload),
      service.addExpense("gathering", "guest", TOKEN, "key-1", payload),
    ]);

    expect(expenses).toHaveLength(1);
    expect(first.id).toBe(second.id);
  });

  it("el reintento no vuelve a incrementar expenseRound", async () => {
    const { client, state } = buildPrisma();
    const service = buildService(client);

    await service.addExpense("gathering", "guest", TOKEN, "key-1", payload);
    const roundAfterFirst = state.expenseRound;
    await service.addExpense("gathering", "guest", TOKEN, "key-1", payload);

    // Si el reintento incrementara la ronda otra vez, invalidaría las
    // transferencias ya confirmadas por segunda vez sin motivo.
    expect(state.expenseRound).toBe(roundAfterFirst);
  });

  it("rechaza cargar un gasto con el token de otra persona", async () => {
    const { client, expenses } = buildPrisma();

    await expect(
      buildService(client).addExpense(
        "gathering",
        "guest",
        generateParticipantToken(),
        "key-1",
        payload,
      ),
    ).rejects.toThrow("No podés cargar gastos por otra persona");
    expect(expenses).toHaveLength(0);
  });
});
