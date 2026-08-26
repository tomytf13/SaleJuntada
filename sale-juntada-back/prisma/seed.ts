import {
  AvailabilityKind,
  GatheringStatus,
  PrismaClient,
  PurchaseCategory,
  RsvpStatus,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { generateParticipantToken } from "../src/participants/participant-token";

const prisma = new PrismaClient();

function atLocalTime(daysFromToday: number, hours: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  date.setHours(hours, 0, 0, 0);
  return date;
}

async function resetGathering(slug: string) {
  const existing = await prisma.gathering.findUnique({ where: { slug } });
  if (existing) {
    await prisma.gathering.delete({ where: { id: existing.id } });
  }
}

async function main() {
  await seedConfirmedGathering();
  await seedOpenGathering();
}

/**
 * Juntada CON fecha confirmada: el RSVP aplica y hay un participante por
 * cada estado posible, para poder ver el resumen completo sin cargar nada
 * a mano.
 */
async function seedConfirmedGathering() {
  const slug = "asado-demo-tucuman";
  await resetGathering(slug);

  const confirmedStart = atLocalTime(3, 21);

  const gathering = await prisma.gathering.create({
    data: {
      slug,
      title: "Asado demo en Tucumán",
      description: "Juntada de prueba para validar el flujo completo.",
      organizerName: "Tomy",
      locationHint: "San Miguel de Tucumán",
      locationLatitude: -26.8083,
      locationLongitude: -65.2176,
      windowStart: atLocalTime(2, 19),
      windowEnd: atLocalTime(5, 0),
      durationMinutes: 180,
      dailyStartMinutes: 19 * 60,
      dailyEndMinutes: 24 * 60,
      slotStepMinutes: 60,
      status: GatheringStatus.CONFIRMED,
      finalizedStart: confirmedStart,
      finalizedLocation: "San Miguel de Tucumán",
    },
  });

  // going = 2 · goingHeadcount = 3 · maybe = 1 · notGoing = 1 · pending = 1
  const participantDefinitions = [
    {
      name: "Tomy",
      avatarUrl: "emoji:🦆",
      isOrganizer: true,
      hours: [19, 20, 21],
      rsvpStatus: RsvpStatus.GOING,
      plusOnes: 0,
    },
    {
      name: "Sofi",
      avatarUrl: "emoji:🐸",
      isOrganizer: false,
      hours: [20, 21],
      rsvpStatus: RsvpStatus.GOING,
      plusOnes: 1,
    },
    {
      name: "Fede",
      avatarUrl: "emoji:🦖",
      isOrganizer: false,
      hours: [19, 21],
      rsvpStatus: RsvpStatus.MAYBE,
      plusOnes: 0,
    },
    {
      name: "Mica",
      avatarUrl: "emoji:🦥",
      isOrganizer: false,
      hours: [21],
      // Todavía no respondió: hay fecha, así que este null es "pendiente".
      rsvpStatus: null,
      plusOnes: 0,
    },
    {
      name: "Nico",
      avatarUrl: "emoji:🐨",
      isOrganizer: false,
      hours: [],
      rsvpStatus: RsvpStatus.NOT_GOING,
      plusOnes: 0,
    },
  ];

  const participants = new Map<string, string>();

  for (const definition of participantDefinitions) {
    const participant = await prisma.participant.create({
      data: {
        gatheringId: gathering.id,
        name: definition.name,
        avatarUrl: definition.avatarUrl,
        isOrganizer: definition.isOrganizer,
        // Mismo generador que usa la aplicación: el seed no debe poder
        // crear participantes con una credencial más débil que la real.
        responseToken: generateParticipantToken(),
        rsvpStatus: definition.rsvpStatus,
        plusOnes: definition.plusOnes,
        rsvpAt: definition.rsvpStatus ? new Date() : null,
      },
    });
    participants.set(definition.name, participant.id);

    await prisma.availability.createMany({
      data: definition.hours.map((hour) => ({
        participantId: participant.id,
        startsAt: atLocalTime(3, hour),
        endsAt: atLocalTime(3, hour + 3),
        kind: AvailabilityKind.AVAILABLE,
      })),
    });
  }

  // Dos gastos con pagadores distintos: alcanza para que la liquidación
  // tenga algo que repartir y se pueda probar el flujo de transferencias.
  await prisma.expense.createMany({
    data: [
      {
        gatheringId: gathering.id,
        paidByParticipantId: participants.get("Tomy")!,
        description: "Carne",
        amountCents: 4_200_000,
        idempotencyKey: randomUUID(),
      },
      {
        gatheringId: gathering.id,
        paidByParticipantId: participants.get("Sofi")!,
        description: "Bebidas y hielo",
        amountCents: 1_800_000,
        idempotencyKey: randomUUID(),
      },
    ],
  });

  const purchasePlan = await prisma.purchasePlan.create({
    data: {
      gatheringId: gathering.id,
      participantBaseline: participantDefinitions.length,
      updatedByParticipantId: participants.get("Tomy")!,
    },
  });

  await prisma.purchaseItem.createMany({
    data: [
      {
        purchasePlanId: purchasePlan.id,
        key: "meat",
        label: "Comida principal",
        unit: "aportes",
        quantity: 1,
        category: PurchaseCategory.FOOD,
        position: 0,
        assignedParticipantId: participants.get("Tomy")!,
        assignedAt: new Date(),
      },
      {
        purchasePlanId: purchasePlan.id,
        key: "salad",
        label: "Acompañamientos",
        unit: "aportes",
        quantity: 1,
        category: PurchaseCategory.FOOD,
        position: 1,
      },
      {
        purchasePlanId: purchasePlan.id,
        key: "ice",
        label: "Hielo",
        unit: "bolsas",
        quantity: 1,
        category: PurchaseCategory.OTHER,
        position: 5,
        assignedParticipantId: participants.get("Fede")!,
        assignedAt: new Date(),
        isReady: true,
      },
    ],
  });

  console.log(`Juntada con fecha: /j/${slug}`);
}

/**
 * Juntada SIN fecha: el RSVP no aplica y todos quedan en `null`. Sirve para
 * probar a mano la encuesta de disponibilidad y las coincidencias, y para
 * comprobar que el endpoint de RSVP la rechaza.
 */
async function seedOpenGathering() {
  const slug = "previa-sin-fecha";
  await resetGathering(slug);

  const gathering = await prisma.gathering.create({
    data: {
      slug,
      title: "Previa sin fecha",
      description: "Todavía estamos viendo qué día nos viene bien.",
      organizerName: "Tomy",
      locationHint: "Yerba Buena",
      // La ventana la eligió quien creó la juntada; no se inventa.
      windowStart: atLocalTime(1, 19),
      windowEnd: atLocalTime(6, 0),
      durationMinutes: 180,
      dailyStartMinutes: 19 * 60,
      dailyEndMinutes: 24 * 60,
      slotStepMinutes: 60,
      status: GatheringStatus.OPEN,
      // Sin fecha confirmada: es lo que hace que el RSVP no aplique.
      finalizedStart: null,
    },
  });

  const definitions = [
    { name: "Tomy", avatarUrl: "emoji:🦆", isOrganizer: true, hours: [19, 20, 21] },
    { name: "Sofi", avatarUrl: "emoji:🐸", isOrganizer: false, hours: [20] },
    { name: "Fede", avatarUrl: "emoji:🦖", isOrganizer: false, hours: [19, 20] },
  ];

  for (const definition of definitions) {
    const participant = await prisma.participant.create({
      data: {
        gatheringId: gathering.id,
        name: definition.name,
        avatarUrl: definition.avatarUrl,
        isOrganizer: definition.isOrganizer,
        responseToken: generateParticipantToken(),
        // Sin fecha, el RSVP no aplica: ni siquiera para quien organiza.
        rsvpStatus: null,
        plusOnes: 0,
        rsvpAt: null,
      },
    });

    await prisma.availability.createMany({
      data: definition.hours.map((hour) => ({
        participantId: participant.id,
        startsAt: atLocalTime(2, hour),
        endsAt: atLocalTime(2, hour + 3),
        kind: AvailabilityKind.AVAILABLE,
      })),
    });
  }

  console.log(`Juntada sin fecha: /j/${slug}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
