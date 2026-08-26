import { ParticipantAuthService } from "../participants/participant-auth.service";
import { RsvpService } from "../rsvp/rsvp.service";
import { generateParticipantToken } from "../participants/participant-token";
import { PrismaService } from "../prisma/prisma.service";
import { GatheringsService } from "./gatherings.service";

const TOKEN = generateParticipantToken();

const storedGathering = {
  id: "gathering",
  slug: "asado",
  title: "Asado con los pibes",
  description: null,
  organizerName: "Tomy",
  status: "OPEN",
  timeZone: "America/Argentina/Buenos_Aires",
  locationHint: "Yerba Buena",
  locationLatitude: -26.8083,
  locationLongitude: -65.2176,
  windowStart: new Date("2026-09-05T22:00:00.000Z"),
  windowEnd: new Date("2026-09-07T03:00:00.000Z"),
  durationMinutes: 180,
  dailyStartMinutes: 19 * 60,
  dailyEndMinutes: 24 * 60,
  slotStepMinutes: 60,
  expenseRound: 1,
  finalizedStart: null,
  finalizedEnd: null,
  finalizedLocation: null,
  participants: [
    {
      id: "host",
      name: "Tomy",
      avatarUrl: "emoji:🦆",
      isOrganizer: true,
      dietaryPreferences: ["CELIAC"],
      mealArrangement: "GROUP_MENU",
      expensesReadyAt: new Date(),
      createdAt: new Date(),
      availabilities: [{ id: "a1", startsAt: new Date(), endsAt: new Date() }],
      rsvpStatus: "GOING",
      plusOnes: 2,
      rsvpAt: new Date(),
    },
    {
      id: "guest",
      name: "Mica",
      avatarUrl: "emoji:🦥",
      isOrganizer: false,
      dietaryPreferences: [],
      mealArrangement: null,
      expensesReadyAt: null,
      createdAt: new Date(),
      availabilities: [],
      rsvpStatus: null,
      plusOnes: 0,
      rsvpAt: null,
    },
  ],
};

function buildService(viewerToken: string | null) {
  const prisma = {
    gathering: {
      findUnique: jest.fn().mockResolvedValue(storedGathering),
    },
    participant: {
      findFirst: jest.fn(({ where }: { where: { responseToken?: string } }) =>
        Promise.resolve(
          viewerToken && where.responseToken === viewerToken
            ? {
                id: "guest",
                name: "Mica",
                isOrganizer: false,
                responseToken: viewerToken,
              }
            : null,
        ),
      ),
    },
  } as unknown as PrismaService;

  return new GatheringsService(prisma, new ParticipantAuthService(prisma), new RsvpService(prisma, new ParticipantAuthService(prisma)));
}

describe("getBySlug vista pública", () => {
  it("no expone las coordenadas exactas", async () => {
    const result = await buildService(null).getBySlug("asado");

    // La latitud y longitud son la casa de alguien. Antes viajaban a
    // cualquiera que tuviera el link.
    expect(result.locationLatitude).toBeNull();
    expect(result.locationLongitude).toBeNull();
    expect(result.locationHint).toBe("Yerba Buena");
  });

  it("no devuelve ningún participante", async () => {
    const result = await buildService(null).getBySlug("asado");

    // Vacío, no reducido: un link reenviado no debe revelar quiénes van.
    expect(result.participants).toEqual([]);
    expect(result.participantCount).toBe(2);
  });

  it("no filtra los nombres de las personas del grupo", async () => {
    const result = await buildService(null).getBySlug("asado");
    const serialized = JSON.stringify(result);

    for (const name of ["Tomy", "Mica"]) {
      expect(serialized).not.toContain(name);
    }
  });

  it("no filtra los avatares de las personas del grupo", async () => {
    const result = await buildService(null).getBySlug("asado");
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("🦆");
    expect(serialized).not.toContain("🦥");
    expect(serialized).not.toContain("avatarUrl");
  });

  it("no expone el nombre de quien organiza", async () => {
    const result = await buildService(null).getBySlug("asado");

    // `organizerName` está desnormalizado en Gathering, pero sigue siendo la
    // identidad de una persona.
    expect(result).not.toHaveProperty("organizerName");
  });

  it("no filtra ids de participantes", async () => {
    const result = await buildService(null).getBySlug("asado");
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("\"host\"");
    expect(serialized).not.toContain("\"guest\"");
    expect(result.viewerParticipantId).toBeNull();
  });

  it("no expone disponibilidad, preferencias ni estado de gastos", async () => {
    const result = await buildService(null).getBySlug("asado");
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("availabilities");
    expect(serialized).not.toContain("dietaryPreferences");
    expect(serialized).not.toContain("mealArrangement");
    expect(serialized).not.toContain("expensesReadyAt");
  });

  it("devuelve sólo los campos necesarios para entender la invitación", async () => {
    const result = await buildService(null).getBySlug("asado");

    // La vista pública se arma con lista blanca: este test falla si alguien
    // agrega un campo sin decidir explícitamente que puede ser público.
    expect(Object.keys(result).sort()).toEqual(
      [
        "dailyEndMinutes",
        "dailyStartMinutes",
        "description",
        "durationMinutes",
        "finalizedEnd",
        "finalizedLocation",
        "finalizedStart",
        "id",
        "isParticipant",
        "locationHint",
        "locationLatitude",
        "locationLongitude",
        "participantCount",
        "participants",
        "slotStepMinutes",
        "slots",
        "slug",
        "status",
        "timeZone",
        "title",
        "viewerParticipantId",
        "windowEnd",
        "windowStart",
      ].sort(),
    );
  });

  it("trata un token inválido como visitante, no como error", async () => {
    const result = await buildService(TOKEN).getBySlug("asado", "token-que-no-es");

    expect(result.isParticipant).toBe(false);
    expect(result.locationLatitude).toBeNull();
    expect(result.participants).toEqual([]);
  });

  it("nunca incluye responseToken de nadie", async () => {
    const result = await buildService(null).getBySlug("asado");

    expect(JSON.stringify(result)).not.toContain("responseToken");
  });

  it("no expone el resumen de RSVP", async () => {
    // Cómo respondió el grupo es información del grupo, no del link.
    const result = await buildService(null).getBySlug("asado");

    expect(result).not.toHaveProperty("rsvpSummary");
    expect(JSON.stringify(result)).not.toContain("goingHeadcount");
  });

  it("no filtra la respuesta individual de nadie", async () => {
    const result = await buildService(null).getBySlug("asado");
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("rsvpStatus");
    expect(serialized).not.toContain("plusOnes");
    expect(serialized).not.toContain("GOING");
  });
});

describe("getBySlug vista de participante", () => {
  it("devuelve coordenadas exactas y disponibilidad con token válido", async () => {
    const result = await buildService(TOKEN).getBySlug("asado", TOKEN);

    expect(result.isParticipant).toBe(true);
    expect(result.viewerParticipantId).toBe("guest");
    expect(result.locationLatitude).toBe(-26.8083);
    expect(result.locationLongitude).toBe(-65.2176);
    expect(result.participants[0]).toHaveProperty("availabilities");
  });

  it("recién acá aparecen nombres, avatares y quien organiza", async () => {
    const result = await buildService(TOKEN).getBySlug("asado", TOKEN);

    // El estrechamiento por `isParticipant` es parte del contrato: sin
    // comprobarlo, TypeScript no deja tocar los campos privados.
    if (!result.isParticipant) throw new Error("Se esperaba la vista privada");
    expect(result.participants.map((participant) => participant.name)).toEqual([
      "Tomy",
      "Mica",
    ]);
    expect(result.participants[0].avatarUrl).toBe("emoji:🦆");
    expect(result.organizerName).toBe("Tomy");
  });

  it("tampoco expone responseToken a un participante", async () => {
    const result = await buildService(TOKEN).getBySlug("asado", TOKEN);

    expect(JSON.stringify(result)).not.toContain("responseToken");
  });

  it("acá sí llega el resumen de RSVP, con el headcount", async () => {
    const result = await buildService(TOKEN).getBySlug("asado", TOKEN);

    if (!result.isParticipant) throw new Error("Se esperaba la vista privada");
    // Tomy GOING +2 · Mica sin responder.
    expect(result.rsvpSummary).toEqual({
      going: 1,
      maybe: 0,
      notGoing: 0,
      pending: 1,
      goingHeadcount: 3,
    });
  });

  it("acá sí llega la respuesta individual de cada persona", async () => {
    const result = await buildService(TOKEN).getBySlug("asado", TOKEN);

    if (!result.isParticipant) throw new Error("Se esperaba la vista privada");
    expect(result.participants[0]).toMatchObject({
      rsvpStatus: "GOING",
      plusOnes: 2,
    });
    expect(result.participants[1].rsvpStatus).toBeNull();
  });

  it("calcula los horarios en la zona de la juntada en ambas vistas", async () => {
    const publicView = await buildService(null).getBySlug("asado");
    const privateView = await buildService(TOKEN).getBySlug("asado", TOKEN);

    expect(publicView.slots.length).toBeGreaterThan(0);
    expect(privateView.slots).toEqual(publicView.slots);
  });
});
