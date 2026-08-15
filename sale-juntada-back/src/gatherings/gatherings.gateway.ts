import {
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { PrismaService } from "../prisma/prisma.service";

type LiveMember = {
  gatheringId: string;
  participantId: string;
  name: string;
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

  constructor(private readonly prisma: PrismaService) {}

  @SubscribeMessage("gathering:watch")
  async watch(client: Socket, payload: { gatheringId: string }) {
    if (!payload.gatheringId) return;
    await client.join(this.room(payload.gatheringId));
    this.broadcastPresence(payload.gatheringId);
  }

  @SubscribeMessage("gathering:join")
  async join(
    client: Socket,
    payload: {
      gatheringId: string;
      participantId: string;
      participantToken: string;
    },
  ) {
    if (
      !payload.gatheringId ||
      !payload.participantId ||
      !payload.participantToken
    ) {
      return;
    }
    const participant = await this.prisma.participant.findFirst({
      where: {
        id: payload.participantId,
        gatheringId: payload.gatheringId,
        responseToken: payload.participantToken,
      },
      select: { id: true, name: true },
    });
    if (!participant) return;
    const member = {
      gatheringId: payload.gatheringId,
      participantId: participant.id,
      name: participant.name,
    };
    this.members.set(client.id, member);
    await client.join(this.room(payload.gatheringId));
    this.broadcastPresence(payload.gatheringId);
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

  dietaryChanged(gatheringId: string, participantName: string) {
    this.server.to(this.room(gatheringId)).emit("dietary:changed", {
      participantName,
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
