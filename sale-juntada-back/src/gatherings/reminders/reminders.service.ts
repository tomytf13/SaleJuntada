import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { GatheringReminder } from "@prisma/client";
import * as push from "web-push";
import { PrismaService } from "../../prisma/prisma.service";
import { GatheringsService } from "../gatherings.service";

const interval = 30 * 60_000;
type Settlement = {
  shares?: Record<string, number>;
  allReady: boolean;
  transfers: Array<{ fromParticipantId: string; settled: boolean }>;
  expenses: Array<{ paidByParticipantId: string }>;
};

export function pendingReminder(
  participant: {
    id: string;
    rsvpStatus: string | null;
    expensesReadyAt: Date | null;
  },
  gathering: { status: string; finalizedStart: Date | null },
  settlement: Settlement | null,
  now: Date,
) {
  if (gathering.status === "CANCELLED") return null;
  const pending: { body: string; page: string }[] = [];
  if (
    gathering.status === "CONFIRMED" &&
    gathering.finalizedStart &&
    gathering.finalizedStart > now &&
    !participant.rsvpStatus
  ) {
    pending.push({ body: "Avisale al grupo si vas.", page: "invitados" });
  }
  if (
    settlement?.allReady &&
    settlement.transfers.some(
      (t) => !t.settled && t.fromParticipantId === participant.id,
    )
  ) {
    pending.push({
      body: "Te queda una transferencia por confirmar.",
      page: "cuentas/transferencias",
    });
  }
  if (
    settlement &&
    !participant.expensesReadyAt &&
    (settlement.shares ? settlement.shares[participant.id] > 0 : participant.rsvpStatus !== "NOT_GOING") &&
    (settlement.expenses.length > 0 ||
      (participant.rsvpStatus === "GOING" &&
        gathering.finalizedStart &&
        gathering.finalizedStart <= now)) &&
    !settlement.expenses.some((e) => e.paidByParticipantId === participant.id)
  ) {
    pending.push({
      body: "Cargá tus gastos o indicá que no tenés gastos.",
      page: "cuentas",
    });
  }
  if (!pending.length) return null;
  return { body: pending.map((p) => p.body).join(" "), page: pending[0].page };
}

@Injectable()
export class RemindersService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly log = new Logger(RemindersService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly gatherings: GatheringsService,
  ) {}
  onModuleInit() {
    this.timer = setInterval(
      () =>
        void this.tick().catch(() =>
          this.log.warn("No se pudieron revisar los recordatorios"),
        ),
      15_000,
    );
    this.timer.unref();
  }
  onModuleDestroy() {
    clearInterval(this.timer);
  }

  private async keys() {
    const saved = await this.prisma.reminderSigningKey.findUnique({
      where: { id: 1 },
    });
    return (
      saved ??
      this.prisma.reminderSigningKey.upsert({
        where: { id: 1 },
        update: { id: 1 },
        create: { id: 1, ...push.generateVAPIDKeys() },
      })
    );
  }

  async settings(participantId: string, deviceId: string) {
    const [subscription, keys] = await Promise.all([
      this.prisma.gatheringReminder.findUnique({
        where: { participantId_deviceId: { participantId, deviceId } },
        select: { deviceId: true },
      }),
      this.keys(),
    ]);
    return { enabled: Boolean(subscription), publicKey: keys.publicKey };
  }

  enable(
    participantId: string,
    deviceId: string,
    data: Pick<GatheringReminder, "endpoint" | "p256dh" | "auth">,
  ) {
    return this.prisma.gatheringReminder.upsert({
      where: { participantId_deviceId: { participantId, deviceId } },
      update: data,
      create: {
        participantId,
        deviceId,
        ...data,
        nextCheck: new Date(Date.now() + interval),
      },
    });
  }
  disable(participantId: string, deviceId: string) {
    return this.prisma.gatheringReminder.deleteMany({
      where: { participantId, deviceId },
    });
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const due = await this.prisma.gatheringReminder.findMany({
        where: { nextCheck: { lte: new Date() } },
        orderBy: { nextCheck: "asc" },
        take: 100,
      });
      for (const row of due) {
        try {
          await this.deliver(row);
        } catch {
          this.log.warn("No se pudo entregar un recordatorio");
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async deliver(row: GatheringReminder) {
    const { participantId, deviceId, endpoint, nextCheck } = row;
    const now = new Date();
    const claim = await this.prisma.gatheringReminder.updateMany({
      where: { participantId, deviceId, endpoint, nextCheck },
      data: { nextCheck: new Date(now.getTime() + interval) },
    });
    if (!claim.count) return;
    const person = await this.prisma.participant.findUnique({
      where: { id: participantId },
      select: {
        id: true,
        gatheringId: true,
        rsvpStatus: true,
        expensesReadyAt: true,
        gathering: {
          select: {
            status: true,
            slug: true,
            title: true,
            finalizedStart: true,
            disabledServices: true,
          },
        },
      },
    });
    if (!person) return;
    const g = person.gathering;
    if (g.status === "CANCELLED") {
      await this.disable(participantId, deviceId);
      return;
    }
    const settlement = g.disabledServices.includes("cuentas")
      ? null
      : await this.gatherings.getExpenseSettlement(person.gatheringId);
    const reminder = pendingReminder(person, g, settlement, now);
    if (!reminder) return;
    const keys = await this.keys();
    try {
      await push.sendNotification(
        { endpoint, keys: { auth: row.auth, p256dh: row.p256dh } },
        JSON.stringify({
          title: g.title,
          body: reminder.body,
          url: `/j/${g.slug}/${reminder.page}`,
          tag: `sale-juntada-${participantId}`,
        }),
        {
          TTL: 0,
          timeout: 5000,
          vapidDetails: {
            subject: "https://salejuntada.com.ar",
            publicKey: keys.publicKey,
            privateKey: keys.privateKey,
          },
        },
      );
    } catch (error) {
      if (
        error instanceof push.WebPushError &&
        [404, 410].includes(error.statusCode)
      ) {
        await this.prisma.gatheringReminder.deleteMany({
          where: { participantId, deviceId, endpoint },
        });
      } else {
        throw error;
      }
    }
  }
}
