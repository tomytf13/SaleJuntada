import { realAccount, realAccountsConfigured } from "../helpers/account";
import { randomUUID } from "node:crypto";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
const api = process.env.E2E_API_URL ?? "http://127.0.0.1:3001/api";
type Participant = { id: string; responseToken: string; accessToken?: string };
const headers = (p: Participant) => ({
  "x-participant-token": p.responseToken,
  Authorization: `Bearer ${p.accessToken}`,
  "idempotency-key": randomUUID(),
});
const participantUrl = (id: string, p: Participant) =>
  `${api}/gatherings/${id}/participants/${p.id}`;
async function fixture(request: APIRequestContext) {
  const response = await request.post(`${api}/gatherings`, {
    headers: { Authorization: `Bearer ${process.env.E2E_AUTH_TOKEN}` },
    data: {
      title: "Servicios del asado",
      organizerName: "Tomy",
      startsAt: "2026-10-04T00:00:00.000Z",
      timeZone: "America/Argentina/Tucuman",
      locationHint: "Casa de Tomy",
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const gathering = (await response.json()) as {
    id: string;
    slug: string;
    participants: Participant[];
  };
  const joined = await request.post(
    `${api}/gatherings/${gathering.id}/participants`,
    { headers: { Authorization: `Bearer ${process.env.E2E_FRIEND_AUTH_TOKEN}` }, data: { name: "Sofi" } },
  );
  expect(joined.ok(), await joined.text()).toBeTruthy();
  return {
    gathering,
    organizer: { ...gathering.participants[0], accessToken: process.env.E2E_AUTH_TOKEN },
    friend: { ...await joined.json(), accessToken: process.env.E2E_FRIEND_AUTH_TOKEN } as Participant,
  };
}
async function session(page: Page, slug: string, participant: Participant) {
  await realAccount(page, participant.accessToken);
  await page.addInitScript(
    ({ slug, participant }) =>
      localStorage.setItem(
        `sale-juntada:participant:${slug}`,
        JSON.stringify({
          participantId: participant.id,
          responseToken: participant.responseToken,
        }),
      ),
    { slug, participant },
  );
}
test.beforeEach(() =>
  test.skip(
    process.env.E2E_REAL_DB !== "1" || !realAccountsConfigured,
    "Requiere API y PostgreSQL local.",
  ),
);

test("organizador configura, invitados reciben en vivo y el historial se conserva", async ({
  page,
  browser,
  request,
}) => {
  const { gathering: g, organizer, friend } = await fixture(request);
  const root = `${api}/gatherings/${g.id}`;
  const orgUrl = participantUrl(g.id, organizer);
  const guestUrl = participantUrl(g.id, friend);
  const set = (service: string, enabled: boolean) =>
    request.put(`${orgUrl}/services/${service}`, {
      headers: headers(organizer),
      data: { enabled },
    });
  expect(
    (
      await request.put(`${guestUrl}/services/juegos`, {
        headers: headers(friend),
        data: { enabled: false },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.put(`${orgUrl}/services/juegos`, {
        data: { enabled: false },
      })
    ).status(),
  ).toBe(401);
  expect((await set("invitados", false)).status()).toBe(400);
  expect(
    (
      await request.put(`${orgUrl}/services/juegos`, {
        headers: headers(organizer),
        data: { enabled: "false" },
      })
    ).status(),
  ).toBe(400);
  const itemResponse = await request.post(`${orgUrl}/checklist`, {
    headers: headers(organizer),
    data: { label: "Parlante" },
  });
  expect(itemResponse.ok()).toBeTruthy();
  const item = await itemResponse.json();
  expect(
    (
      await request.patch(`${guestUrl}/checklist/${item.id}`, {
        headers: headers(friend),
        data: { action: "claim" },
      })
    ).ok(),
  ).toBeTruthy();
  await session(page, g.slug, organizer);
  await page.goto(`/j/${g.slug}/servicios`);
  await expect(page.locator(".connection-status")).toHaveText("En vivo");
  await expect(page.getByRole("switch")).toHaveCount(5);
  const context = await browser.newContext({
    viewport: page.viewportSize() ?? undefined,
  });
  const guest = await context.newPage();
  await session(guest, g.slug, friend);
  const origin = new URL(page.url()).origin;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  guest.on("pageerror", (e) => errors.push(e.message));
  try {
    await guest.goto(`${origin}/j/${g.slug}/pendientes`);
    await expect(guest.locator(".connection-status")).toHaveText("En vivo");
    await expect(guest.locator(".checklist-items")).toContainText(
      "Sofi (vos) · Pendiente",
    );
    await page.getByRole("switch", { name: "Pendientes y útiles" }).click();
    await expect(
      page.getByRole("switch", { name: "Pendientes y útiles" }),
    ).not.toBeChecked();
    await expect(guest.locator(".service-archived-banner")).toBeVisible();
    await expect(
      guest.getByRole("button", { name: "Ya está listo" }),
    ).toBeDisabled();
    await expect(guest.getByLabel("Agregar una necesidad")).toHaveCount(0);
    expect(
      (
        await request.patch(`${guestUrl}/checklist/${item.id}`, {
          headers: headers(friend),
          data: { action: "ready" },
        })
      ).status(),
    ).toBe(409);
    await guest.reload();
    await expect(guest.locator(".service-archived-banner")).toBeVisible();
    await guest.goto(`${origin}/j/${g.slug}/servicios`);
    await expect(guest.getByRole("switch")).toHaveCount(0);
    await expect(guest.locator(".archived-services")).toContainText(
      "Pendientes y útiles",
    );
    await guest.goto(`${origin}/j/${g.slug}`);
    await expect(guest.locator(".gathering-service-card")).toHaveCount(5);
    await guest.goto(`${origin}/j/${g.slug}/pendientes`);
    await page.getByRole("switch", { name: "Pendientes y útiles" }).click();
    await expect(
      guest.getByRole("button", { name: "Ya está listo" }),
    ).toBeEnabled();
    await expect(guest.locator(".checklist-items")).toContainText(
      "Sofi (vos) · Pendiente",
    );
    await context.setOffline(true);
    await expect(guest.locator(".connection-status")).toContainText(
      "Reconectando",
    );
    await page.getByRole("switch", { name: "Pendientes y útiles" }).click();
    await context.setOffline(false);
    await expect(guest.locator(".service-archived-banner")).toBeVisible();
    // Per-key concurrent updates must not overwrite one another.
    const updates = await Promise.all(
      ["compra", "alimentacion", "juegos", "cuentas"].map((key) =>
        set(key, false),
      ),
    );
    updates.forEach((r) => expect(r.ok()).toBeTruthy());
    await expect(page.getByRole("switch", { checked: false })).toHaveCount(5);
    const saved = await (
      await request.get(`${api}/gatherings/${g.slug}`, {
        headers: headers(friend),
      })
    ).json();
    expect(saved.disabledServices.sort()).toEqual([
      "alimentacion",
      "compra",
      "cuentas",
      "juegos",
      "pendientes",
    ]);
    expect(
      (
        await request.put(`${guestUrl}/dietary-profile`, {
          headers: headers(friend),
          data: {
            dietaryPreferences: ["VEGAN"],
            mealArrangement: "SELF_MANAGED",
          },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await request.put(`${orgUrl}/purchase`, {
          headers: headers(organizer),
          data: { includeAlcohol: false, ageConfirmed: false, items: [] },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await request.post(`${guestUrl}/expenses`, {
          headers: headers(friend),
          data: { description: "Hielo", amountCents: 10000 },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await request.post(`${guestUrl}/expenses/ready`, {
          headers: headers(friend),
        })
      ).status(),
    ).toBe(409);
    await page.reload();
    await expect(page.getByRole("switch", { checked: false })).toHaveCount(5);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: test.info().outputPath("servicios-configuracion.png"),
      fullPage: true,
    });
    await guest.goto(`${origin}/j/${g.slug}`);
    await expect(guest.locator(".gathering-service-card")).toHaveCount(1);
    await expect(
      guest.locator(`a:visible[href="/j/${g.slug}/fecha"]`).first(),
    ).toBeVisible();
    const publicView = await (
      await request.get(`${api}/gatherings/${g.slug}`)
    ).json();
    expect(publicView.disabledServices).toBeUndefined();
    expect(publicView.archivedExpenseSettlement).toBeUndefined();
    expect((await set("pendientes", true)).ok()).toBeTruthy();
    const history = await (
      await request.get(`${root}/checklist`, { headers: headers(friend) })
    ).json();
    expect(history[0].assignedParticipantId).toBe(friend.id);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("Cuentas exige cierre, conserva su liquidación al archivar y bloquea carreras", async ({
  request,
}) => {
  test.skip(!process.env.E2E_THIRD_AUTH_TOKEN, "Requiere una tercera cuenta para sumar a Nico.");
  const { gathering: g, organizer, friend } = await fixture(request);
  const orgUrl = participantUrl(g.id, organizer);
  const guestUrl = participantUrl(g.id, friend);
  const toggle = (enabled: boolean) =>
    request.put(`${orgUrl}/services/cuentas`, {
      headers: headers(organizer),
      data: { enabled },
    });
  const expense = await request.post(`${orgUrl}/expenses`, {
    headers: headers(organizer),
    data: { description: "Asado", amountCents: 20000 },
  });
  expect(expense.ok()).toBeTruthy();
  expect((await toggle(false)).status()).toBe(409);
  for (const p of [organizer, friend])
    expect(
      (
        await request.post(`${participantUrl(g.id, p)}/expenses/ready`, {
          headers: headers(p),
        })
      ).ok(),
    ).toBeTruthy();
  expect((await toggle(false)).status()).toBe(409);
  expect(
    (
      await request.post(`${guestUrl}/transfers/confirm`, {
        headers: headers(friend),
        data: { toParticipantId: organizer.id, amountCents: 10000 },
      })
    ).ok(),
  ).toBeTruthy();
  expect((await toggle(false)).ok()).toBeTruthy();
  const read = async () =>
    (
      await request.get(`${api}/gatherings/${g.id}/expenses/settlement`, {
        headers: headers(friend),
      })
    ).json();
  const archived = await read();
  expect(archived.transfers).toHaveLength(0);
  expect(
    (
      await request.post(`${api}/gatherings/${g.id}/participants`, {
        headers: { Authorization: `Bearer ${process.env.E2E_THIRD_AUTH_TOKEN}` },
        data: { name: "Nico" },
      })
    ).ok(),
  ).toBeTruthy();
  expect(await read()).toEqual(archived);
  expect((await toggle(true)).ok()).toBeTruthy();
  expect((await read()).transfers.length).toBeGreaterThan(0);

  const race = await fixture(request);
  const raceUrl = participantUrl(race.gathering.id, race.organizer);
  const [archiveResult, expenseResult] = await Promise.all([
    request.put(`${raceUrl}/services/cuentas`, {
      headers: headers(race.organizer),
      data: { enabled: false },
    }),
    request.post(`${raceUrl}/expenses`, {
      headers: headers(race.organizer),
      data: { description: "Compra concurrente", amountCents: 10000 },
    }),
  ]);
  // If the write wins, archive is rejected; if archive wins, the write is rejected.
  expect([archiveResult.status(), expenseResult.status()].sort()).toEqual(
    archiveResult.ok() ? [200, 409] : [201, 409],
  );
});
