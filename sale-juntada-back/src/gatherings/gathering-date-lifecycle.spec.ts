import { GatheringStatus, RsvpStatus } from "@prisma/client";
import { ParticipantAuthService } from "../participants/participant-auth.service";
import { generateParticipantToken } from "../participants/participant-token";
import { PrismaService } from "../prisma/prisma.service";
import { RsvpService } from "../rsvp/rsvp.service";
import { GatheringsService } from "./gatherings.service";
import { calendarDayInZone } from "./slots";

const TOKEN = generateParticipantToken();
const TUCUMAN = "America/Argentina/Tucuman";

type ParticipantRow = {
  id: string;
  isOrganizer: boolean;
  rsvpStatus: RsvpStatus | null;
  plusOnes: number;
  rsvpAt: Date | null;
};

/**
 * Base en memoria con las dos tablas que importan acá. `updateMany` aplica
 * el `where` de verdad —incluido `isOrganizer`— porque los resets tratan
 * distinto a quien organiza y al resto: un doble que ignorara el filtro no
 * probaría nada.
 */
function buildWorld(options: {
  status?: GatheringStatus;
  finalizedStart?: Date | null;
  windowStart?: Date;
  windowEnd?: Date;
}) {
  const gathering = {
    id: "gathering",
    slug: "asado",
    status: options.status ?? GatheringStatus.OPEN,
    finalizedStart: options.finalizedStart ?? null,
    finalizedEnd: null as Date | null,
    finalizedLocation: null as string | null,
    locationHint: "Yerba Buena",
    locationLatitude: null,
    locationLongitude: null,
    timeZone: "America/Argentina/Tucuman",
    windowStart: options.windowStart ?? new Date("2026-09-05T00:00:00.000Z"),
    windowEnd: options.windowEnd ?? new Date("2026-09-12T00:00:00.000Z"),
    durationMinutes: 180,
    dailyStartMinutes: 0,
    dailyEndMinutes: 1440,
    slotStepMinutes: 60,
    title: "Asado",
  };

  const participants: ParticipantRow[] = [
    {
      id: "organizer",
      isOrganizer: true,
      rsvpStatus: RsvpStatus.GOING,
      plusOnes: 2,
      rsvpAt: new Date("2026-09-01T00:00:00.000Z"),
    },
    {
      id: "a",
      isOrganizer: false,
      rsvpStatus: RsvpStatus.GOING,
      plusOnes: 1,
      rsvpAt: new Date("2026-09-01T00:00:00.000Z"),
    },
    {
      id: "b",
      isOrganizer: false,
      rsvpStatus: RsvpStatus.MAYBE,
      plusOnes: 0,
      rsvpAt: new Date("2026-09-01T00:00:00.000Z"),
    },
    {
      id: "c",
      isOrganizer: false,
      rsvpStatus: RsvpStatus.NOT_GOING,
      plusOnes: 0,
      rsvpAt: new Date("2026-09-01T00:00:00.000Z"),
    },
  ];

  const prisma = {
    participant: {
      findFirst: jest.fn().mockResolvedValue({
        id: "organizer",
        isOrganizer: true,
        responseToken: TOKEN,
        gathering,
      }),
      updateMany: jest.fn(
        ({
          where,
          data,
        }: {
          where: { isOrganizer?: boolean };
          data: Partial<ParticipantRow>;
        }) => {
          let count = 0;
          for (const participant of participants) {
            if (
              where.isOrganizer !== undefined &&
              participant.isOrganizer !== where.isOrganizer
            ) {
              continue;
            }
            Object.assign(participant, data);
            count += 1;
          }
          return Promise.resolve({ count });
        },
      ),
    },
    availability: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    gathering: {
      update: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        Object.assign(gathering, data);
        return Promise.resolve(gathering);
      }),
      findUnique: jest.fn(() =>
        Promise.resolve({ ...gathering, participants: [] }),
      ),
    },
    $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
      callback(prisma),
    ),
  } as unknown as PrismaService;

  const auth = new ParticipantAuthService(prisma);
  return {
    service: new GatheringsService(prisma, auth, new RsvpService(prisma, auth)),
    participants,
    gathering,
    byId: (id: string) => participants.find((p) => p.id === id)!,
  };
}

const SEPT_6 = "2026-09-06T22:00:00.000Z";
const SEPT_6_END = "2026-09-07T01:00:00.000Z";
const SEPT_9 = "2026-09-09T22:00:00.000Z";
const SEPT_9_END = "2026-09-10T01:00:00.000Z";

describe("finalizeGathering — confirma la fecha y habilita el RSVP", () => {
  it("pasa la juntada a confirmada con la fecha elegida", async () => {
    const { service, gathering } = buildWorld({});

    await service.finalizeGathering("gathering", "organizer", TOKEN, {
      startsAt: SEPT_6,
      endsAt: SEPT_6_END,
    });

    expect(gathering.status).toBe(GatheringStatus.CONFIRMED);
    expect(gathering.finalizedStart).toEqual(new Date(SEPT_6));
  });

  it("deja al organizador confirmado", async () => {
    const { service, byId } = buildWorld({});

    await service.finalizeGathering("gathering", "organizer", TOKEN, {
      startsAt: SEPT_6,
      endsAt: SEPT_6_END,
    });

    const organizer = byId("organizer");
    expect(organizer.rsvpStatus).toBe(RsvpStatus.GOING);
    expect(organizer.plusOnes).toBe(0);
    expect(organizer.rsvpAt).toBeInstanceOf(Date);
  });

  it("deja al resto sin responder", async () => {
    // Nadie confirmó esta fecha todavía: recién ahora existe.
    const { service, byId } = buildWorld({});

    await service.finalizeGathering("gathering", "organizer", TOKEN, {
      startsAt: SEPT_6,
      endsAt: SEPT_6_END,
    });

    for (const id of ["a", "b", "c"]) {
      const participant = byId(id);
      expect(participant.rsvpStatus).toBeNull();
      expect(participant.plusOnes).toBe(0);
      expect(participant.rsvpAt).toBeNull();
    }
  });
});

describe("finalizeGathering — mover la fecha directamente", () => {
  // Sábado 29 21:00 en Tucumán (UTC-3) = domingo 30 00:00 UTC.
  const SAT_29 = "2026-08-30T00:00:00.000Z";
  const SUN_30 = "2026-08-31T00:00:00.000Z";
  const SUN_30_END = "2026-08-31T03:00:00.000Z";

  function confirmedOnSaturday() {
    return buildWorld({
      status: GatheringStatus.CONFIRMED,
      finalizedStart: new Date(SAT_29),
      // Ventana de un solo día: es la que deriva la creación con fecha.
      windowStart: new Date("2026-08-29T03:00:00.000Z"),
      windowEnd: new Date("2026-08-30T03:00:00.000Z"),
    });
  }

  it("mueve la juntada a otro día sin reabrir la búsqueda", async () => {
    // Antes esto fallaba: la fecha nueva caía fuera de la ventana de un día
    // y había que reabrir la encuesta primero. Cambiar la fecha y reabrir la
    // búsqueda son dos acciones distintas.
    const { service, gathering } = confirmedOnSaturday();

    await service.finalizeGathering("gathering", "organizer", TOKEN, {
      startsAt: SUN_30,
      endsAt: SUN_30_END,
    });

    expect(gathering.status).toBe(GatheringStatus.CONFIRMED);
    expect(gathering.finalizedStart).toEqual(new Date(SUN_30));
  });

  it("recalcula la ventana al día local de la fecha nueva", async () => {
    const { service, gathering } = confirmedOnSaturday();

    await service.finalizeGathering("gathering", "organizer", TOKEN, {
      startsAt: SUN_30,
      endsAt: SUN_30_END,
    });

    // La ventana tiene que describir el domingo 30 local, no el sábado.
    expect(calendarDayInZone(gathering.windowStart, TUCUMAN)).toEqual({
      year: 2026,
      month: 8,
      day: 30,
    });
    expect(calendarDayInZone(gathering.windowEnd, TUCUMAN)).not.toEqual({
      year: 2026,
      month: 8,
      day: 29,
    });
  });

  it("mantiene las invariantes de la ventana", async () => {
    const { service, gathering } = confirmedOnSaturday();

    await service.finalizeGathering("gathering", "organizer", TOKEN, {
      startsAt: SUN_30,
      endsAt: SUN_30_END,
    });

    expect(gathering.windowStart.getTime()).toBeLessThan(
      gathering.windowEnd.getTime(),
    );
    expect(gathering.windowStart.getTime()).toBeLessThanOrEqual(
      gathering.finalizedStart!.getTime(),
    );
    expect(gathering.finalizedStart!.getTime()).toBeLessThan(
      gathering.windowEnd.getTime(),
    );
  });

  it("deriva la ventana por la zona de la juntada y no por UTC", async () => {
    // 02:00 UTC del 31 es todavía el 30 por la noche en Tucumán.
    const { service, gathering } = confirmedOnSaturday();

    await service.finalizeGathering("gathering", "organizer", TOKEN, {
      startsAt: "2026-08-31T02:00:00.000Z",
      endsAt: "2026-08-31T05:00:00.000Z",
    });

    expect(calendarDayInZone(gathering.windowStart, TUCUMAN)).toEqual({
      year: 2026,
      month: 8,
      day: 30,
    });
  });

  it("resetea el RSVP igual que cualquier cambio de fecha", async () => {
    const { service, byId } = confirmedOnSaturday();

    await service.finalizeGathering("gathering", "organizer", TOKEN, {
      startsAt: SUN_30,
      endsAt: SUN_30_END,
    });

    expect(byId("organizer").rsvpStatus).toBe(RsvpStatus.GOING);
    expect(byId("organizer").plusOnes).toBe(0);
    for (const id of ["a", "b", "c"]) {
      expect(byId(id).rsvpStatus).toBeNull();
      expect(byId(id).plusOnes).toBe(0);
    }
  });

  it("no toca la ventana si se reconfirma el mismo instante", async () => {
    const { service, gathering } = confirmedOnSaturday();
    const originalStart = gathering.windowStart;

    await service.finalizeGathering("gathering", "organizer", TOKEN, {
      startsAt: SAT_29,
      endsAt: "2026-08-30T03:00:00.000Z",
    });

    expect(gathering.windowStart).toBe(originalStart);
  });
});

describe("finalizeGathering — cambiar una fecha ya confirmada", () => {
  it("resetea el RSVP del resto", async () => {
    // Una confirmación pertenece a una fecha concreta: si la fecha cambia,
    // lo que respondieron antes ya no significa lo mismo.
    const { service, byId } = buildWorld({
      status: GatheringStatus.CONFIRMED,
      finalizedStart: new Date(SEPT_6),
    });

    await service.finalizeGathering("gathering", "organizer", TOKEN, {
      startsAt: SEPT_9,
      endsAt: SEPT_9_END,
    });

    for (const id of ["a", "b", "c"]) {
      expect(byId(id).rsvpStatus).toBeNull();
      expect(byId(id).plusOnes).toBe(0);
      expect(byId(id).rsvpAt).toBeNull();
    }
  });

  it("mantiene al organizador confirmado pero le resetea los acompañantes", async () => {
    // Los acompañantes también dependen de la fecha: quien venía con dos
    // personas el domingo no necesariamente puede el miércoles.
    const { service, byId } = buildWorld({
      status: GatheringStatus.CONFIRMED,
      finalizedStart: new Date(SEPT_6),
    });

    await service.finalizeGathering("gathering", "organizer", TOKEN, {
      startsAt: SEPT_9,
      endsAt: SEPT_9_END,
    });

    const organizer = byId("organizer");
    expect(organizer.rsvpStatus).toBe(RsvpStatus.GOING);
    expect(organizer.plusOnes).toBe(0);
  });

  it("no resetea si se reconfirma exactamente la misma fecha", async () => {
    const { service, byId } = buildWorld({
      status: GatheringStatus.CONFIRMED,
      finalizedStart: new Date(SEPT_6),
    });

    await service.finalizeGathering("gathering", "organizer", TOKEN, {
      startsAt: SEPT_6,
      endsAt: SEPT_6_END,
    });

    expect(byId("a").rsvpStatus).toBe(RsvpStatus.GOING);
    expect(byId("a").plusOnes).toBe(1);
    expect(byId("b").rsvpStatus).toBe(RsvpStatus.MAYBE);
    expect(byId("organizer").plusOnes).toBe(2);
  });

  it("compara instantes, no cadenas: otra representación de la misma fecha no resetea", async () => {
    const { service, byId } = buildWorld({
      status: GatheringStatus.CONFIRMED,
      finalizedStart: new Date(SEPT_6),
    });

    // Mismo instante expresado con offset en vez de Z.
    await service.finalizeGathering("gathering", "organizer", TOKEN, {
      startsAt: "2026-09-06T19:00:00.000-03:00",
      endsAt: SEPT_6_END,
    });

    expect(byId("a").rsvpStatus).toBe(RsvpStatus.GOING);
    expect(byId("a").plusOnes).toBe(1);
  });
});

describe("updateGathering — editar sin tocar la fecha", () => {
  it("no resetea el RSVP al cambiar sólo la ubicación", async () => {
    const { service, byId } = buildWorld({
      status: GatheringStatus.CONFIRMED,
      finalizedStart: new Date(SEPT_6),
    });

    await service.updateGathering("gathering", "organizer", TOKEN, {
      locationHint: "Casa de Nico",
    });

    expect(byId("a").rsvpStatus).toBe(RsvpStatus.GOING);
    expect(byId("a").plusOnes).toBe(1);
    expect(byId("organizer").plusOnes).toBe(2);
  });

  it("no resetea el RSVP al cambiar sólo el título", async () => {
    const { service, byId } = buildWorld({
      status: GatheringStatus.CONFIRMED,
      finalizedStart: new Date(SEPT_6),
    });

    await service.updateGathering("gathering", "organizer", TOKEN, {
      title: "Asado de despedida",
    });

    expect(byId("b").rsvpStatus).toBe(RsvpStatus.MAYBE);
    expect(byId("c").rsvpStatus).toBe(RsvpStatus.NOT_GOING);
  });
});

describe("updateGathering — reabrir la búsqueda de fecha", () => {
  it("vuelve a abrir la juntada y borra la fecha", async () => {
    const { service, gathering } = buildWorld({
      status: GatheringStatus.CONFIRMED,
      finalizedStart: new Date(SEPT_6),
    });

    await service.updateGathering("gathering", "organizer", TOKEN, {
      windowStart: "2026-09-14T00:00:00.000Z",
      windowEnd: "2026-09-21T00:00:00.000Z",
    });

    expect(gathering.status).toBe(GatheringStatus.OPEN);
    expect(gathering.finalizedStart).toBeNull();
    expect(gathering.finalizedEnd).toBeNull();
  });

  it("resetea el RSVP de todos, incluido quien organiza", async () => {
    // Sin fecha el RSVP no aplica para nadie.
    const { service, participants } = buildWorld({
      status: GatheringStatus.CONFIRMED,
      finalizedStart: new Date(SEPT_6),
    });

    await service.updateGathering("gathering", "organizer", TOKEN, {
      windowStart: "2026-09-14T00:00:00.000Z",
      windowEnd: "2026-09-21T00:00:00.000Z",
    });

    for (const participant of participants) {
      expect(participant.rsvpStatus).toBeNull();
      expect(participant.plusOnes).toBe(0);
      expect(participant.rsvpAt).toBeNull();
    }
  });
});

describe("cancelGathering — conserva el contexto", () => {
  function confirmedWithContext() {
    const world = buildWorld({
      status: GatheringStatus.CONFIRMED,
      finalizedStart: new Date(SEPT_6),
    });
    world.gathering.finalizedEnd = new Date(SEPT_6_END);
    world.gathering.finalizedLocation = "Yerba Buena";
    return world;
  }

  it("conserva cuándo y dónde iba a ser", async () => {
    // Cancelar no borra la historia. Una juntada cancelada tiene que poder
    // decir "iba a ser el 6 a las 22:00 en Yerba Buena": es el contexto que
    // explica de qué se está hablando.
    const { service, gathering } = confirmedWithContext();

    await service.cancelGathering("gathering", "organizer", TOKEN);

    expect(gathering.status).toBe(GatheringStatus.CANCELLED);
    expect(gathering.finalizedStart).toEqual(new Date(SEPT_6));
    expect(gathering.finalizedEnd).toEqual(new Date(SEPT_6_END));
    expect(gathering.finalizedLocation).toBe("Yerba Buena");
  });

  it("conserva la ventana", async () => {
    const { service, gathering } = confirmedWithContext();
    const windowStart = gathering.windowStart;
    const windowEnd = gathering.windowEnd;

    await service.cancelGathering("gathering", "organizer", TOKEN);

    expect(gathering.windowStart).toBe(windowStart);
    expect(gathering.windowEnd).toBe(windowEnd);
  });

  it("conserva las respuestas del grupo", async () => {
    // P1.1 ya impide modificarlas después: quedan como registro.
    const { service, byId } = confirmedWithContext();

    await service.cancelGathering("gathering", "organizer", TOKEN);

    expect(byId("organizer").rsvpStatus).toBe(RsvpStatus.GOING);
    expect(byId("organizer").plusOnes).toBe(2);
    expect(byId("a").rsvpStatus).toBe(RsvpStatus.GOING);
    expect(byId("a").plusOnes).toBe(1);
    expect(byId("b").rsvpStatus).toBe(RsvpStatus.MAYBE);
    expect(byId("c").rsvpStatus).toBe(RsvpStatus.NOT_GOING);
  });

  it("también conserva el contexto de una juntada que nunca tuvo fecha", async () => {
    const { service, gathering } = buildWorld({ status: GatheringStatus.OPEN });
    const windowStart = gathering.windowStart;

    await service.cancelGathering("gathering", "organizer", TOKEN);

    expect(gathering.status).toBe(GatheringStatus.CANCELLED);
    expect(gathering.finalizedStart).toBeNull();
    expect(gathering.windowStart).toBe(windowStart);
  });
});
