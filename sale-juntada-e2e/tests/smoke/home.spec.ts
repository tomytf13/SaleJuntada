import { expect, test } from "@playwright/test";

const emptySettlement = {
  totalCents: 0,
  participantCount: 0,
  averageCents: 0,
  expenseRound: 1,
  allReady: false,
  readyParticipants: [],
  pendingReadyParticipants: [],
  expenses: [],
  balances: [],
  transfers: [],
  completedTransfers: [],
};

test("abre una juntada sembrada desde PostgreSQL real", async ({ page, request }) => {
  test.skip(
    process.env.E2E_REAL_DB !== "1",
    "Requiere npm run db:setup y el backend local en el puerto 3001.",
  );

  await page.goto("/j/asado-demo-tucuman");

  await expect(
    page.getByRole("heading", { name: "Asado demo en Tucumán" }).first(),
  ).toBeVisible();
  await expect(page.locator(".response-pill")).toHaveText("4/4 respondieron");

  const gatheringResponse = await request.get(
    "http://127.0.0.1:3001/api/gatherings/asado-demo-tucuman",
  );
  expect(gatheringResponse.ok()).toBeTruthy();
  const gathering = await gatheringResponse.json() as { id: string };
  const matchesResponse = await request.get(
    `http://127.0.0.1:3001/api/gatherings/${gathering.id}/matches`,
  );
  expect(matchesResponse.ok()).toBeTruthy();
  const matches = await matchesResponse.json() as Array<{
    available: number;
    total: number;
  }>;
  expect(matches[0]).toMatchObject({ available: 4, total: 4 });
});

test("permite elegir disponibilidad y buscar coincidencias", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: /Hagamos que el plan salga|Que coincidir sea la parte fácil/i,
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: /Dom 26 Jul · 13:00/i }).click();
  await page.getByRole("button", { name: /Encontrar el mejor momento/i }).click();

  await expect(
    page.getByRole("heading", { name: /Qué falta para que salga/i }),
  ).toBeVisible();
});

test("crea una juntada y abre su enlace compartible", async ({ page }) => {
  const gathering = {
    id: "gathering-1",
    slug: "asado-del-viernes-a1b2c3",
    title: "Asado del viernes",
    organizerName: "Tomás",
    locationHint: "Yerba Buena",
    windowStart: "2026-07-25T03:00:00.000Z",
    windowEnd: "2026-07-28T02:59:59.000Z",
    durationMinutes: 180,
    participants: [
      {
        id: "participant-1",
        name: "Tomás",
        isOrganizer: true,
        responseToken: "organizer-secret",
        availabilities: [],
      },
    ],
    proposals: [],
  };

  await page.route("**/api/gatherings**", async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      await route.fulfill({ status: 201, json: gathering });
      return;
    }
    if (request.url().includes("/matches")) {
      await route.fulfill({ status: 200, json: [] });
      return;
    }
    if (request.url().includes("/expenses/settlement")) {
      await route.fulfill({ status: 200, json: emptySettlement });
      return;
    }
    await route.fulfill({ status: 200, json: gathering });
  });

  await page.goto("/");
  await page.getByRole("button", { name: /Crear una juntada/i }).click();
  await page.getByLabel("Nombre de la juntada").fill("Asado del viernes");
  await page.getByLabel("Tu nombre").fill("Tomás");
  await page.getByLabel(/Dirección o lugar/i).fill("Yerba Buena");
  await page.getByRole("button", { name: /Crear y elegir horarios/i }).click();

  await expect(page).toHaveURL(/\/j\/asado-del-viernes-a1b2c3$/);
  await expect(
    page.getByRole("heading", { name: "Asado del viernes" }).first(),
  ).toBeVisible();
  await expect(page.getByText(/Juntada creada/i)).toBeVisible();
});

test("un invitado entra sin registro y guarda su disponibilidad", async ({
  page,
}) => {
  const gathering = {
    id: "gathering-2",
    slug: "birras-en-el-centro-d4e5f6",
    title: "Birras en el centro",
    organizerName: "Tomás",
    locationHint: "Centro",
    windowStart: "2026-07-25T03:00:00.000Z",
    windowEnd: "2026-07-28T02:59:59.000Z",
    durationMinutes: 180,
    participants: [
      {
        id: "organizer-2",
        name: "Tomás",
        isOrganizer: true,
        availabilities: [],
      },
    ],
    proposals: [],
  };
  let savedToken = "";
  let savedSlots: unknown[] = [];

  await page.route("**/api/gatherings**", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      if (request.url().includes("/matches")) {
        await route.fulfill({ status: 200, json: [] });
        return;
      }
      if (request.url().includes("/expenses/settlement")) {
        await route.fulfill({ status: 200, json: emptySettlement });
        return;
      }
      await route.fulfill({ status: 200, json: gathering });
      return;
    }
    if (request.method() === "POST") {
      await route.fulfill({
        status: 201,
        json: {
          id: "participant-2",
          name: "Sofi",
          isOrganizer: false,
          responseToken: "sofi-secret",
          availabilities: [],
        },
      });
      return;
    }
    if (request.method() === "PUT") {
      savedToken = request.headers()["x-participant-token"];
      savedSlots = (request.postDataJSON() as { slots: unknown[] }).slots;
      await route.fulfill({
        status: 200,
        json: {
          id: "participant-2",
          name: "Sofi",
          isOrganizer: false,
          availabilities: savedSlots,
        },
      });
      return;
    }
    await route.abort();
  });

  await page.goto("/j/birras-en-el-centro-d4e5f6");
  await page.getByLabel("Tu nombre").fill("Sofi");
  await page.getByRole("button", { name: /Entrar y marcar horarios/i }).click();
  await expect(page.getByText("Sofi (vos)")).toBeVisible();

  await page
    .getByRole("group", { name: /Elegí tus horarios disponibles/i })
    .getByRole("button")
    .first()
    .click();

  await expect.poll(() => savedToken).toBe("sofi-secret");
  await expect.poll(() => savedSlots.length).toBe(1);
});

test("carga un gasto y calcula quién transfiere a quién", async ({ page }) => {
  const gathering = {
    id: "gathering-3",
    slug: "pizza-del-sabado-g7h8i9",
    title: "Pizza del sábado",
    organizerName: "Tomás",
    locationHint: "Centro",
    windowStart: "2026-07-25T03:00:00.000Z",
    windowEnd: "2026-07-28T02:59:59.000Z",
    durationMinutes: 180,
    participants: [
      {
        id: "organizer-3",
        name: "Tomás",
        isOrganizer: true,
        availabilities: [],
      },
    ],
    proposals: [],
  };
  let expenseCreated = false;
  let expenseToken = "";

  await page.route("**/api/gatherings**", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      if (request.url().includes("/matches")) {
        await route.fulfill({ status: 200, json: [] });
        return;
      }
      if (request.url().includes("/expenses/settlement")) {
        await route.fulfill({
          status: 200,
          json: expenseCreated
            ? {
                totalCents: 12000,
                participantCount: 2,
                averageCents: 6000,
                expenseRound: 1,
                allReady: true,
                readyParticipants: [
                  { participantId: "organizer-3", name: "Tomás" },
                  { participantId: "participant-3", name: "Sofi" },
                ],
                pendingReadyParticipants: [],
                expenses: [
                  {
                    id: "expense-1",
                    description: "Pizzas",
                    amountCents: 12000,
                    paidByParticipantId: "participant-3",
                    paidBy: { id: "participant-3", name: "Sofi" },
                    createdAt: "2026-07-25T23:00:00.000Z",
                  },
                ],
                balances: [
                  {
                    participantId: "organizer-3",
                    name: "Tomás",
                    paidCents: 0,
                    owedCents: 6000,
                    balanceCents: -6000,
                  },
                  {
                    participantId: "participant-3",
                    name: "Sofi",
                    paidCents: 12000,
                    owedCents: 6000,
                    balanceCents: 6000,
                  },
                ],
                transfers: [
                  {
                    id: "organizer-3:participant-3:6000",
                    fromParticipantId: "organizer-3",
                    fromName: "Tomás",
                    toParticipantId: "participant-3",
                    toName: "Sofi",
                    amountCents: 6000,
                    settled: false,
                  },
                ],
                completedTransfers: [],
              }
            : emptySettlement,
        });
        return;
      }
      await route.fulfill({ status: 200, json: gathering });
      return;
    }
    if (request.url().includes("/expenses")) {
      expenseCreated = true;
      expenseToken = request.headers()["x-participant-token"];
      await route.fulfill({
        status: 201,
        json: {
          id: "expense-1",
          description: "Pizzas",
          amountCents: 12000,
          paidByParticipantId: "participant-3",
          paidBy: { id: "participant-3", name: "Sofi" },
          createdAt: "2026-07-25T23:00:00.000Z",
        },
      });
      return;
    }
    if (request.method() === "POST") {
      await route.fulfill({
        status: 201,
        json: {
          id: "participant-3",
          name: "Sofi",
          isOrganizer: false,
          responseToken: "sofi-expense-secret",
          availabilities: [],
        },
      });
      return;
    }
    await route.abort();
  });

  await page.goto("/j/pizza-del-sabado-g7h8i9");
  await page.getByLabel("Tu nombre").fill("Sofi");
  await page.getByRole("button", { name: /Entrar y marcar horarios/i }).click();

  await page.getByLabel("Concepto").fill("Pizzas");
  await page.getByLabel("Monto").fill("12000");
  await expect(page.getByLabel("Monto")).toHaveValue("12.000");
  await page.getByLabel("Monto").fill("120");
  await page.getByRole("button", { name: /Agregar y recalcular/i }).click();

  await expect.poll(() => expenseToken).toBe("sofi-expense-secret");
  const transfer = page.locator(".transfer-row");
  await expect(transfer.getByText("Tomás")).toBeVisible();
  await expect(transfer.getByText(/le transfiere a Sofi/i)).toBeVisible();
  await expect(transfer.getByText(/60,00/)).toBeVisible();
});
