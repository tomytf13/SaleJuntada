import { realAccount, realAccountsConfigured } from "../helpers/account";
import { expect, test, type Page } from "@playwright/test";
const api = process.env.E2E_API_URL ?? "http://127.0.0.1:3001/api";

test("navegación modular, borradores, enlaces directos y sesión persistente", async ({ page, request }) => {
  test.skip(process.env.E2E_REAL_DB !== "1" || !realAccountsConfigured, "Requiere API y PostgreSQL local.");
  await realAccount(page);
  const response = await request.post(`${api}/gatherings`, { headers: { Authorization: `Bearer ${process.env.E2E_AUTH_TOKEN}` }, data: {
    title: "Asado modular", organizerName: "Tomy", startsAt: "2026-10-04T00:00:00.000Z", timeZone: "America/Argentina/Tucuman", locationHint: "Casa de Tomy",
  }});
  expect(response.ok()).toBeTruthy();
  const gathering = await response.json();
  const organizer = gathering.participants[0];
  await page.addInitScript(({ slug, participantId, responseToken }) => {
    localStorage.setItem(`sale-juntada:participant:${slug}`, JSON.stringify({ participantId, responseToken }));
  }, { slug: gathering.slug, participantId: organizer.id, responseToken: organizer.responseToken });
  const base = `/j/${gathering.slug}`;
  const errors: string[] = [];
  const sockets: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("websocket", ws => { if (ws.url().includes("socket.io")) sockets.push(ws.url()); });
  const navigate = async (target: string) => {
    await page.locator(`a:visible[href="${base}${target ? `/${target}` : ""}"]`).first().click();
  };
  const expectFits = async (target: Page) => expect(await target.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto(base);
  await expect(page.locator(".connection-status")).toHaveText("En vivo");
  const originalSockets = sockets.length;
  await expect(page.getByRole("heading", { name: "Servicios de esta juntada" })).toBeVisible();
  await expect(page.locator(".gathering-service-card")).toHaveCount(6);
  await expect(page.getByLabel("Agregar una necesidad")).toHaveCount(0);
  await expectFits(page);
  await page.screenshot({ path: test.info().outputPath("inicio-modular.png"), fullPage: true });

  await navigate("pendientes");
  await page.getByLabel("Agregar una necesidad").fill("Hielera grande");
  await navigate("invitados");
  await expect(page.getByRole("heading", { name: "Quiénes vienen" })).toBeVisible();
  await expect(page.getByLabel("Agregar una necesidad")).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(`${new URL(page.url()).origin}${base}/pendientes`);
  await expect(page.getByLabel("Agregar una necesidad")).toHaveValue("Hielera grande");
  await page.getByRole("button", { name: "Agregar", exact: true }).click();
  await expect(page.locator(".checklist-items")).toContainText("Hielera grande");
  await navigate("servicios");
  await navigate("cuentas");
  await page.getByLabel("Concepto", { exact: true }).fill("Carne y verduras");
  await page.getByRole("textbox", { name: "Monto" }).fill("24000");
  await navigate("cuentas/transferencias");
  await expect(page.getByRole("heading", { name: "Quién transfiere a quién" })).toBeVisible();
  await expect(page.getByLabel("Concepto", { exact: true })).toHaveCount(0);
  await navigate("cuentas");
  await expect(page.getByLabel("Concepto", { exact: true })).toHaveValue("Carne y verduras");
  await expect(page.getByRole("textbox", { name: "Monto" })).toHaveValue("24.000");
  await page.getByRole("button", { name: "Agregar y recalcular" }).click();
  await expect(page.locator(".expense-history")).toContainText("Carne y verduras");

  await navigate("servicios");
  await navigate("alimentacion");
  await page.getByText("Vegetariano", { exact: true }).click();
  await page.getByRole("radio", { name: /Me ocupo yo/ }).click();
  await navigate("servicios");
  await navigate("alimentacion");
  await expect(page.getByRole("checkbox", { name: /Vegetariano/ })).toBeChecked();
  await page.getByRole("button", { name: "Guardar mi elección" }).click();
  await expect(page.locator(".dietary-summary")).toContainText("Vegetariano");
  await expectFits(page);

  await page.getByRole("link", { name: "Ir a compra y aportes →" }).click();
  const tile = page.getByTestId("responsibility-meat");
  await tile.getByRole("button", { name: /Sumar mi aporte/ }).click();
  await tile.getByLabel(/Qué vas a llevar/).fill("Verduras para asar");
  await navigate("servicios");
  await navigate("compra");
  await expect(tile.getByLabel(/Qué vas a llevar/)).toHaveValue("Verduras para asar");
  await expectFits(page);
  expect(sockets.length).toBe(originalSockets);

  await navigate("servicios");
  await navigate("juegos");
  await expect(page.getByRole("heading", { name: "Una ronda rápida." })).toBeVisible();
  await expectFits(page);
  await navigate("mi-parte");
  await expect(page.getByRole("heading", { name: "Lo que te toca a vos" })).toBeVisible();
  await navigate("invitados");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Quiénes vienen" })).toBeVisible();
  await expect(page.getByRole("button", { name: /sumarme/i })).toHaveCount(0);
  await expectFits(page);
  expect(errors).toEqual([]);
});
