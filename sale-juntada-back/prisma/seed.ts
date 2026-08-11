import { AvailabilityKind, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function atLocalTime(daysFromToday: number, hours: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  date.setHours(hours, 0, 0, 0);
  return date;
}

async function main() {
  const slug = "asado-demo-tucuman";
  const existing = await prisma.gathering.findUnique({ where: { slug } });
  if (existing) {
    await prisma.gathering.delete({ where: { id: existing.id } });
  }

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
      windowEnd: atLocalTime(4, 23),
      durationMinutes: 180,
      dailyStartMinutes: 19 * 60,
      dailyEndMinutes: 23 * 60,
      slotStepMinutes: 60,
    },
  });

  const participantDefinitions = [
    { name: "Tomy", avatarUrl: "emoji:🦆", isOrganizer: true, hours: [19, 20, 21] },
    { name: "Sofi", avatarUrl: "emoji:🐸", isOrganizer: false, hours: [20, 21] },
    { name: "Fede", avatarUrl: "emoji:🦖", isOrganizer: false, hours: [19, 21] },
    { name: "Mica", avatarUrl: "emoji:🦥", isOrganizer: false, hours: [21] },
  ];

  for (const definition of participantDefinitions) {
    const participant = await prisma.participant.create({
      data: {
        gatheringId: gathering.id,
        name: definition.name,
        avatarUrl: definition.avatarUrl,
        isOrganizer: definition.isOrganizer,
      },
    });

    await prisma.availability.createMany({
      data: definition.hours.map((hour) => ({
        participantId: participant.id,
        startsAt: atLocalTime(3, hour),
        endsAt: atLocalTime(3, hour + 3),
        kind: AvailabilityKind.AVAILABLE,
      })),
    });
  }

  console.log(`Datos demo listos: /j/${slug}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
