import { io } from "socket.io-client";

const API_URL = process.env.DEMO_API_URL ?? "http://localhost:3001/api";
const APP_URL = process.env.DEMO_APP_URL ?? "http://localhost:5173";

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function api(path, init) {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${await response.text()}`);
  }
  return response.json();
}

function participantHeaders(participant) {
  return { "x-participant-token": participant.responseToken };
}

async function addExpense(gathering, participant, description, amountCents) {
  const socket = participant.socket;
  socket.emit("expense:typing", {
    gatheringId: gathering.id,
    isTyping: true,
  });
  console.log(`${participant.name} está escribiendo “${description}”…`);
  await wait(2_000);
  await api(
    `/gatherings/${gathering.id}/participants/${participant.id}/expenses`,
    {
      method: "POST",
      headers: participantHeaders(participant),
      body: JSON.stringify({ description, amountCents }),
    },
  );
  socket.emit("expense:typing", {
    gatheringId: gathering.id,
    isTyping: false,
  });
  console.log(`${participant.name} cargó $${amountCents / 100}.`);
  await wait(2_500);
}

async function markReady(gathering, participant) {
  await api(
    `/gatherings/${gathering.id}/participants/${participant.id}/expenses/ready`,
    {
      method: "POST",
      headers: participantHeaders(participant),
    },
  );
  console.log(`${participant.name} confirmó que terminó.`);
  await wait(1_100);
}

async function settleEverything(gathering, participantsById) {
  for (let step = 0; step < 12; step += 1) {
    const settlement = await api(
      `/gatherings/${gathering.id}/expenses/settlement`,
    );
    const transfer = settlement.transfers[0];
    if (!transfer) return;
    const sender = participantsById.get(transfer.fromParticipantId);
    await api(
      `/gatherings/${gathering.id}/participants/${sender.id}/transfers/confirm`,
      {
        method: "POST",
        headers: participantHeaders(sender),
        body: JSON.stringify({
          toParticipantId: transfer.toParticipantId,
          amountCents: transfer.amountCents,
        }),
      },
    );
    console.log(
      `${transfer.fromName} transfirió $${transfer.amountCents / 100} a ${transfer.toName}.`,
    );
    await wait(1_600);
  }
}

const now = new Date();
const gathering = await api("/gatherings", {
  method: "POST",
  body: JSON.stringify({
    title: `Demo gastos en vivo ${now.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`,
    organizerName: "Tomi Demo",
    locationHint: "Living de prueba",
    windowStart: "2026-07-25T03:00:00.000Z",
    windowEnd: "2026-07-28T02:59:59.000Z",
    durationMinutes: 180,
  }),
});

const organizer = gathering.participants[0];
const participants = [organizer];
for (const name of ["Sofi Demo", "Fede Demo", "Mica Demo", "Nico Demo"]) {
  participants.push(
    await api(`/gatherings/${gathering.id}/participants`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  );
}

console.log(`DEMO_URL=${APP_URL}/j/${gathering.slug}#gastos`);
console.log("La simulación empieza en 10 segundos.");

for (const participant of participants) {
  const socket = io(APP_URL.replace(":5173", ":3001"), {
    transports: ["websocket"],
  });
  participant.socket = socket;
  await new Promise((resolve) => socket.on("connect", resolve));
  socket.emit("gathering:join", {
    gatheringId: gathering.id,
    participantId: participant.id,
    participantToken: participant.responseToken,
  });
}

await wait(10_000);
participants[3].socket.emit("analysis:started", {
  gatheringId: gathering.id,
});
console.log("Mica Demo está analizando horarios…");
await wait(4_000);

await addExpense(gathering, participants[0], "Picada completa", 4_500_000);
await addExpense(gathering, participants[1], "Bebidas", 1_800_000);
await addExpense(gathering, participants[2], "Hielo y carbón", 700_000);

console.log("El grupo empieza a cerrar la ronda 1.");
for (const participant of participants) {
  await markReady(gathering, participant);
}

await wait(2_500);
console.log("Simulando las transferencias de la ronda 1.");
await settleEverything(
  gathering,
  new Map(participants.map((participant) => [participant.id, participant])),
);

await wait(4_000);
console.log("Apareció un gasto olvidado: se abre el ajuste.");
await addExpense(gathering, participants[4], "Taxi que faltaba", 1_000_000);

for (const participant of participants) {
  await markReady(gathering, participant);
}

console.log("Ajuste listo. La demo queda visible durante 30 segundos.");
await wait(30_000);
for (const participant of participants) participant.socket.disconnect();
