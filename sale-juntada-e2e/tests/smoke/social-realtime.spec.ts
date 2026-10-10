import { realAccount, realAccountsConfigured } from "../helpers/account";
import { expect, test } from "@playwright/test";

const api = process.env.E2E_API_URL ?? "http://127.0.0.1:3001/api";

test("dos invitados ven asistencia, acompañantes y necesidades en tiempo real", async ({
  browser,
  page,
  request,
}) => {
  test.skip(
    process.env.E2E_REAL_DB !== "1" || !realAccountsConfigured,
    "Requiere API y PostgreSQL local con migraciones aplicadas.",
  );
  await realAccount(page);
  const response = await request.post(`${api}/gatherings`, {
    headers: { Authorization: `Bearer ${process.env.E2E_AUTH_TOKEN}` },
    data: {
      title: "Asado de prueba en vivo",
      organizerName: "Tomy",
      startsAt: "2026-10-04T00:00:00.000Z",
      timeZone: "America/Argentina/Tucuman",
      locationHint: "Yerba Buena",
    },
  });
  expect(response.ok()).toBeTruthy();
  const gathering = (await response.json()) as {
    id: string;
    slug: string;
    participants: Array<{ id: string; responseToken: string }>;
  };
  const organizer = gathering.participants[0];
  await page.addInitScript(
    ({ slug, participantId, responseToken }) => {
      localStorage.setItem(
        `sale-juntada:participant:${slug}`,
        JSON.stringify({ participantId, responseToken }),
      );
    },
    {
      slug: gathering.slug,
      participantId: organizer.id,
      responseToken: organizer.responseToken,
    },
  );
  await page.goto(`/j/${gathering.slug}`);
  await expect(page.locator(".connection-status")).toBeVisible();
  await page.locator(`a:visible[href="/j/${gathering.slug}/invitados"]`).first().click();

  const guestContext = await browser.newContext({
    viewport: page.viewportSize() ?? undefined,
  });
  const guest = await guestContext.newPage();
  await realAccount(guest, process.env.E2E_FRIEND_AUTH_TOKEN);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  guest.on("pageerror", (error) => errors.push(error.message));
  try {
    await guest.goto(`${new URL(page.url()).origin}/j/${gathering.slug}`);
    await expect(
      guest.getByRole("heading", { name: "Asado de prueba en vivo", level: 1 }),
    ).toBeVisible();
    await expect(guest.getByRole("radiogroup")).toHaveCount(0);
    await expect(guest.getByText("Tomy", { exact: true })).toHaveCount(0);
    await guest.getByRole("button", { name: /Aceptar invitación/i }).click();
    await guest.getByLabel("Tu nombre").fill("Sofi");
    await guest.getByRole("button", { name: "Entrar y responder" }).click();
    await expect(guest.locator(".connection-status")).toBeVisible();
    await expect(page.getByText("Sofi", { exact: true })).toBeVisible();
    await guest.locator(`a:visible[href="/j/${gathering.slug}/invitados"]`).first().click();
    await guest.getByRole("radio", { name: "Voy", exact: true }).click();
    await expect(page.locator(".attendance-counts")).toContainText("2 van");
    await guest.getByRole("button", { name: "Agregar acompañante" }).click();
    await expect(
      page.getByText("3 personas contando acompañantes"),
    ).toBeVisible();
    await guest.getByRole("radio", { name: "No sé", exact: true }).click();
    await expect(page.locator(".attendance-counts")).toContainText(
      "1 van · 1 no saben",
    );
    await expect(
      guest.getByRole("group", { name: "Acompañantes" }),
    ).toHaveCount(0);

    await page.locator(`a:visible[href="/j/${gathering.slug}/servicios"]`).first().click();
    await page.locator(`a:visible[href="/j/${gathering.slug}/pendientes"]`).first().click();
    await guest.locator(`a:visible[href="/j/${gathering.slug}/servicios"]`).first().click();
    await guest.locator(`a:visible[href="/j/${gathering.slug}/pendientes"]`).first().click();
    await page.getByRole("button", { name: "+ Carbón", exact: true }).click();
    const organizerItem = page
      .locator(".checklist-items li")
      .filter({ hasText: "Carbón" });
    const guestItem = guest
      .locator(".checklist-items li")
      .filter({ hasText: "Carbón" });
    await expect(guestItem).toContainText("Sin responsable");
    await guestItem.getByRole("button", { name: "Me encargo" }).click();
    await expect(organizerItem).toContainText("Sofi · Pendiente");
    await guestItem.getByRole("button", { name: "Ya está listo" }).click();
    await expect(organizerItem).toContainText("Sofi · Listo");
    await organizerItem
      .getByLabel("Responsable de Carbón")
      .selectOption(organizer.id);
    await expect(guestItem).toContainText("Tomy · Pendiente");
    await expect(
      guestItem.getByRole("button", { name: "Ya está listo" }),
    ).toHaveCount(0);
    await guestContext.setOffline(true);
    await expect(guest.locator(".connection-status")).toContainText(
      "Reconectando",
    );
    await organizerItem.getByRole("button", { name: "Ya está listo" }).click();
    await guestContext.setOffline(false);
    await expect(guestItem).toContainText("Tomy · Listo");

    // La respuesta y la lista sobreviven a la recarga: no son sólo estado local.
    await guest.reload();
    await expect(guestItem).toContainText("Tomy · Listo");
    await guest.locator(`a:visible[href="/j/${gathering.slug}/invitados"]`).first().click();
    await expect(guest.getByRole("radio", { name: "No sé", exact: true })).toHaveAttribute("aria-checked", "true");
    expect(
      await guest.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: test.info().outputPath("organizador.png"),
      fullPage: true,
    });
    await guest.screenshot({
      path: test.info().outputPath("invitado.png"),
      fullPage: true,
    });
    expect(errors).toEqual([]);
    expect(
      (
        await request.get(`${api}/gatherings/${gathering.id}/checklist`)
      ).status(),
    ).toBe(401);
    const cancelled = await request.delete(
      `${api}/gatherings/${gathering.id}/participants/${organizer.id}/settings`,
      { headers: { "x-participant-token": organizer.responseToken, Authorization: `Bearer ${process.env.E2E_AUTH_TOKEN}` } },
    );
    expect(cancelled.ok()).toBeTruthy();
    await expect(guest.getByText(/Esta juntada fue cancelada/)).toBeVisible();
    await expect(guest.getByRole("radiogroup")).toHaveCount(0);
    expect(
      (
        await request.post(
          `${api}/gatherings/${gathering.id}/participants/${organizer.id}/checklist`,
          {
            headers: { "x-participant-token": organizer.responseToken, Authorization: `Bearer ${process.env.E2E_AUTH_TOKEN}` },
            data: { label: "Sal" },
          },
        )
      ).status(),
    ).toBe(409);
  } finally {
    await guestContext.close();
  }
});
