import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const apiUrl = process.env.API_URL ?? "http://127.0.0.1:3001/api";
const demoSlug = process.env.DEMO_SLUG ?? "asado-demo-tucuman";
const prisma = new PrismaClient();
let gatheringId;

try {
  const gathering = await prisma.gathering.findUnique({
    where: { slug: demoSlug },
    include: { participants: true },
  });
  assert(gathering, `No existe la juntada ${demoSlug}`);
  gatheringId = gathering.id;

  const organizer = gathering.participants.find(
    (participant) => participant.isOrganizer,
  );
  const guest = gathering.participants.find(
    (participant) => !participant.isOrganizer,
  );
  assert(organizer, "La demo no tiene organizador");
  assert(guest, "La demo no tiene una persona invitada");

  const planResponse = await fetch(
    `${apiUrl}/gatherings/${gathering.id}/purchase`,
  );
  assert.equal(planResponse.status, 200);
  const plan = await planResponse.json();
  const payload = {
    includeAlcohol: false,
    ageConfirmed: false,
    items: plan.items.map((item) => ({
      key: item.key,
      quantity: item.key === "meat" ? item.quantity + 1 : item.quantity,
    })),
  };

  const guestResponse = await fetch(
    `${apiUrl}/gatherings/${gathering.id}/participants/${guest.id}/purchase`,
    {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-participant-token": guest.responseToken,
      },
      body: JSON.stringify(payload),
    },
  );
  assert.equal(guestResponse.status, 401);

  const organizerResponse = await fetch(
    `${apiUrl}/gatherings/${gathering.id}/participants/${organizer.id}/purchase`,
    {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-participant-token": organizer.responseToken,
      },
      body: JSON.stringify(payload),
    },
  );
  assert.equal(organizerResponse.status, 200);
  const saved = await organizerResponse.json();
  assert.equal(saved.persisted, true);
  assert.equal(
    saved.items.find((item) => item.key === "meat").quantity,
    plan.items.find((item) => item.key === "meat").quantity + 1,
  );

  const responsibilityUrl =
    `${apiUrl}/gatherings/${gathering.id}/participants/${guest.id}` +
    "/purchase/items/meat/responsibility";
  const claimResponse = await fetch(responsibilityUrl, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-participant-token": guest.responseToken,
    },
    body: JSON.stringify({ action: "claim" }),
  });
  assert.equal(claimResponse.status, 200);
  const claimed = await claimResponse.json();
  assert.equal(
    claimed.items.find((item) => item.key === "meat").assignedTo.id,
    guest.id,
  );

  const competingClaimResponse = await fetch(
    `${apiUrl}/gatherings/${gathering.id}/participants/${organizer.id}` +
      "/purchase/items/meat/responsibility",
    {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-participant-token": organizer.responseToken,
      },
      body: JSON.stringify({ action: "claim" }),
    },
  );
  assert.equal(competingClaimResponse.status, 409);

  const readyResponse = await fetch(responsibilityUrl, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-participant-token": guest.responseToken,
    },
    body: JSON.stringify({ action: "ready" }),
  });
  assert.equal(readyResponse.status, 200);
  const ready = await readyResponse.json();
  assert.equal(
    ready.items.find((item) => item.key === "meat").isReady,
    true,
  );

  console.log(
    JSON.stringify({
      guestStatus: guestResponse.status,
      organizerStatus: organizerResponse.status,
      persisted: saved.persisted,
      purchaseItems: saved.items.length,
      claimedBy: guest.name,
      competingClaimStatus: competingClaimResponse.status,
      ready: true,
    }),
  );
} finally {
  if (gatheringId) {
    await prisma.purchasePlan.deleteMany({ where: { gatheringId } });
  }
  await prisma.$disconnect();
}
