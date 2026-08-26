import {
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { RsvpStatus } from "@prisma/client";
import { Server, Socket } from "socket.io";
import { ParticipantAuthService } from "../participants/participant-auth.service";

type LiveMember = {
  gatheringId: string;
  participantId: string;
  name: string;
};

type WatchPayload = {
  gatheringId?: string;
  participantId?: string;
  participantToken?: string;
};

@WebSocketGateway({
  cors: {
    origin: (
      process.env.FRONTEND_URLS ??
      process.env.FRONTEND_URL ??
      "http://localhost:5173"
    )
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
  },
})
export class GatheringsGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly members = new Map<string, LiveMember>();

  constructor(private readonly participantAuth: ParticipantAuthService) {}

  /**
   * Suscribe el socket a los eventos de la juntada.
   *
   * Antes alcanzaba con mandar un `gatheringId`: cualquiera que lo
   * conociera entraba a la sala y recibía la presencia con nombres, quién
   * estaba escribiendo un gasto y cada cambio de la compra. Ahora exige la
   * misma credencial que el resto de la API, resuelta por el mismo servicio
   * que usan los endpoints HTTP para que no puedan divergir.
   */
  @SubscribeMessage("gathering:watch")
  async watch(client: Socket, payload: WatchPayload) {
    const member = await this.authorize(payload);
    if (!member) return;
    await client.join(this.room(member.gatheringId));
    this.broadcastPresence(member.gatheringId);
  }

  /** Igual que `watch`, y además publica la presencia de esta persona. */
  @SubscribeMessage("gathering:join")
  async join(client: Socket, payload: WatchPayload) {
    const member = await this.authorize(payload);
    if (!member) return;
    this.members.set(client.id, member);
    await client.join(this.room(member.gatheringId));
    this.broadcastPresence(member.gatheringId);
  }

  private async authorize(payload: WatchPayload): Promise<LiveMember | null> {
    if (!payload?.gatheringId || !payload.participantToken) return null;

    const participant = await this.participantAuth.findByToken(
      payload.gatheringId,
      payload.participantToken,
    );
    if (!participant) return null;
    // El cliente manda `participantId` además del token; si no coinciden es
    // una inconsistencia y no una suscripción legítima.
    if (payload.participantId && payload.participantId !== participant.id) {
      return null;
    }

    return {
      gatheringId: payload.gatheringId,
      participantId: participant.id,
      name: participant.name,
    };
  }

  @SubscribeMessage("expense:typing")
  expenseTyping(
    client: Socket,
    payload: { gatheringId: string; isTyping: boolean },
  ) {
    const member = this.members.get(client.id);
    if (!member || member.gatheringId !== payload.gatheringId) return;
    client.to(this.room(payload.gatheringId)).emit("expense:typing", {
      participantId: member.participantId,
      name: member.name,
      isTyping: payload.isTyping,
    });
  }

  @SubscribeMessage("analysis:started")
  analysisStarted(client: Socket, payload: { gatheringId: string }) {
    const member = this.members.get(client.id);
    if (!member || member.gatheringId !== payload.gatheringId) return;
    this.server.to(this.room(payload.gatheringId)).emit("analysis:activity", {
      participantId: member.participantId,
      name: member.name,
      active: true,
    });
    setTimeout(() => {
      this.server.to(this.room(payload.gatheringId)).emit("analysis:activity", {
        participantId: member.participantId,
        name: member.name,
        active: false,
      });
    }, 4_000);
  }

  handleDisconnect(client: Socket) {
    const member = this.members.get(client.id);
    this.members.delete(client.id);
    if (member) this.broadcastPresence(member.gatheringId);
  }

  expensesChanged(gatheringId: string, participantName: string) {
    this.server.to(this.room(gatheringId)).emit("expenses:changed", {
      participantName,
    });
  }

  transfersChanged(gatheringId: string, participantName: string) {
    this.server.to(this.room(gatheringId)).emit("transfers:changed", {
      participantName,
    });
  }

  /**
   * Avisa que alguien respondió la invitación.
   *
   * Sólo llega a la sala autenticada: después de P0, quien tiene el link
   * pero no se sumó no entra al room y por lo tanto no ve las respuestas
   * del grupo. El payload es el mínimo para que la UI actualice sin
   * recargar; el resumen completo lo trae `getBySlug`.
   */
  rsvpChanged(
    gatheringId: string,
    activity: {
      participantId: string;
      participantName: string;
      rsvpStatus: RsvpStatus | null;
      plusOnes: number;
    },
  ) {
    this.server.to(this.room(gatheringId)).emit("rsvp:changed", activity);
  }

  dietaryChanged(gatheringId: string, participantName: string) {
    this.server.to(this.room(gatheringId)).emit("dietary:changed", {
      participantName,
    });
  }

  gatheringChanged(
    gatheringId: string,
    action: "confirmed" | "updated" | "cancelled",
  ) {
    this.server.to(this.room(gatheringId)).emit("gathering:changed", {
      action,
    });
  }

  purchaseChanged(
    gatheringId: string,
    activity?: {
      action:
        | "claim"
        | "release"
        | "ready"
        | "pending"
        | "contribute"
        | "remove";
      itemKey: string;
      itemLabel: string;
      participantId: string;
      participantName: string;
    },
  ) {
    this.server.to(this.room(gatheringId)).emit("purchase:changed", activity);
  }

  private broadcastPresence(gatheringId: string) {
    const uniqueMembers = new Map<string, LiveMember>();
    for (const member of this.members.values()) {
      if (member.gatheringId === gatheringId) {
        uniqueMembers.set(member.participantId, member);
      }
    }
    this.server.to(this.room(gatheringId)).emit(
      "presence:changed",
      [...uniqueMembers.values()].map(({ participantId, name }) => ({
        participantId,
        name,
      })),
    );
  }

  private room(gatheringId: string) {
    return `gathering:${gatheringId}`;
  }
}
