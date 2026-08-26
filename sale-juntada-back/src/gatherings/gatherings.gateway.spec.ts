import { Server, Socket } from "socket.io";
import { ParticipantAuthService } from "../participants/participant-auth.service";
import { generateParticipantToken } from "../participants/participant-token";
import { GatheringsGateway } from "./gatherings.gateway";

const TOKEN = generateParticipantToken();

function buildGateway(
  participant: { id: string; name: string; isOrganizer: boolean } | null,
) {
  const auth = {
    findByToken: jest.fn().mockResolvedValue(participant),
  } as unknown as ParticipantAuthService;
  const gateway = new GatheringsGateway(auth);
  const emit = jest.fn();
  gateway.server = { to: jest.fn(() => ({ emit })) } as unknown as Server;
  return { gateway, auth, emit };
}

function buildClient(id = "socket-1") {
  return { id, join: jest.fn().mockResolvedValue(undefined) } as unknown as Socket;
}

const member = { id: "guest", name: "Mica", isOrganizer: false };

describe("GatheringsGateway gathering:watch", () => {
  it("suscribe a un participante con credencial válida", async () => {
    const { gateway } = buildGateway(member);
    const client = buildClient();

    await gateway.watch(client, {
      gatheringId: "gathering",
      participantId: "guest",
      participantToken: TOKEN,
    });

    expect(client.join).toHaveBeenCalledWith("gathering:gathering");
  });

  it("no suscribe sin credenciales", async () => {
    // Éste era el agujero: alcanzaba con conocer el id de la juntada para
    // recibir presencia, tipeos de gasto y cambios de compra.
    const { gateway, auth } = buildGateway(member);
    const client = buildClient();

    await gateway.watch(client, { gatheringId: "gathering" });

    expect(client.join).not.toHaveBeenCalled();
    expect(auth.findByToken).not.toHaveBeenCalled();
  });

  it("no suscribe con un token inválido", async () => {
    const { gateway } = buildGateway(null);
    const client = buildClient();

    await gateway.watch(client, {
      gatheringId: "gathering",
      participantToken: TOKEN,
    });

    expect(client.join).not.toHaveBeenCalled();
  });

  it("no suscribe si el token es de otra juntada", async () => {
    const { gateway } = buildGateway(null);
    const client = buildClient();

    await gateway.watch(client, {
      gatheringId: "otra-juntada",
      participantToken: TOKEN,
    });

    expect(client.join).not.toHaveBeenCalled();
  });

  it("rechaza cuando el participantId no coincide con el dueño del token", async () => {
    const { gateway } = buildGateway(member);
    const client = buildClient();

    await gateway.watch(client, {
      gatheringId: "gathering",
      participantId: "otra-persona",
      participantToken: TOKEN,
    });

    expect(client.join).not.toHaveBeenCalled();
  });

  it("no suscribe sin gatheringId", async () => {
    const { gateway } = buildGateway(member);
    const client = buildClient();

    await gateway.watch(client, { participantToken: TOKEN });

    expect(client.join).not.toHaveBeenCalled();
  });
});

describe("GatheringsGateway rsvp:changed", () => {
  it("emite sólo a la sala de la juntada", async () => {
    const { gateway, emit } = buildGateway(member);

    gateway.rsvpChanged("gathering", {
      participantId: "guest",
      participantName: "Mica",
      rsvpStatus: "GOING",
      plusOnes: 1,
    });

    expect(gateway.server.to).toHaveBeenCalledWith("gathering:gathering");
    expect(emit).toHaveBeenCalledWith("rsvp:changed", {
      participantId: "guest",
      participantName: "Mica",
      rsvpStatus: "GOING",
      plusOnes: 1,
    });
  });

  it("no incluye el token ni datos sensibles en el payload", async () => {
    const { gateway, emit } = buildGateway(member);

    gateway.rsvpChanged("gathering", {
      participantId: "guest",
      participantName: "Mica",
      rsvpStatus: "NOT_GOING",
      plusOnes: 0,
    });

    const payload = JSON.stringify(emit.mock.calls[0][1]);
    expect(payload).not.toContain("responseToken");
    expect(payload).not.toContain("Token");
  });
});

describe("GatheringsGateway presencia", () => {
  it("publica al participante al unirse y lo saca al desconectarse", async () => {
    const { gateway, emit } = buildGateway(member);
    const client = buildClient();

    await gateway.join(client, {
      gatheringId: "gathering",
      participantId: "guest",
      participantToken: TOKEN,
    });

    expect(emit).toHaveBeenLastCalledWith("presence:changed", [
      { participantId: "guest", name: "Mica" },
    ]);

    gateway.handleDisconnect(client);

    expect(emit).toHaveBeenLastCalledWith("presence:changed", []);
  });

  it("un socket sin autorizar no aparece en la presencia", async () => {
    const { gateway, emit } = buildGateway(null);
    const client = buildClient();

    await gateway.join(client, {
      gatheringId: "gathering",
      participantToken: TOKEN,
    });

    expect(emit).not.toHaveBeenCalled();
  });
});
