import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { AvailabilityKind, PurchaseCategory } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AddExpenseDto } from "./dto/add-expense.dto";
import { AddParticipantDto } from "./dto/add-participant.dto";
import { ConfirmTransferDto } from "./dto/confirm-transfer.dto";
import { CreateGatheringDto } from "./dto/create-gathering.dto";
import { GoogleParticipantDto } from "./dto/google-participant.dto";
import { SetAvailabilityDto } from "./dto/set-availability.dto";
import { UpdatePurchasePlanDto } from "./dto/update-purchase-plan.dto";

const purchaseCatalog = [
  {
    key: "meat",
    label: "Carne",
    unit: "kg",
    category: PurchaseCategory.FOOD,
    suggest: (people: number) => Math.max(1, Math.ceil(people * 0.45)),
  },
  {
    key: "bread",
    label: "Pan",
    unit: "bolsas",
    category: PurchaseCategory.FOOD,
    suggest: (people: number) => Math.max(1, Math.ceil(people / 4)),
  },
  {
    key: "salad",
    label: "Ensalada",
    unit: "fuentes",
    category: PurchaseCategory.FOOD,
    suggest: (people: number) => Math.max(1, Math.ceil(people / 3)),
  },
  {
    key: "soda",
    label: "Gaseosas",
    unit: "botellas de 2 L",
    category: PurchaseCategory.DRINKS,
    suggest: (people: number) => Math.max(1, Math.ceil(people / 2)),
  },
  {
    key: "water",
    label: "Agua",
    unit: "botellas de 2 L",
    category: PurchaseCategory.DRINKS,
    suggest: (people: number) => Math.max(1, Math.ceil(people / 3)),
  },
  {
    key: "ice",
    label: "Hielo",
    unit: "bolsas",
    category: PurchaseCategory.OTHER,
    suggest: (people: number) => Math.max(1, Math.ceil(people / 3)),
  },
  {
    key: "charcoal",
    label: "Carbón",
    unit: "bolsas",
    category: PurchaseCategory.OTHER,
    suggest: (people: number) => Math.max(1, Math.ceil(people / 4)),
  },
  {
    key: "beer",
    label: "Cerveza",
    unit: "litros",
    category: PurchaseCategory.ALCOHOL,
    suggest: (people: number) => Math.max(1, people),
  },
];

type StoredPurchasePlan = {
  id: string;
  includeAlcohol: boolean;
  ageConfirmed: boolean;
  participantBaseline: number;
  updatedAt: Date;
  items: Array<{
    key: string;
    label: string;
    unit: string;
    quantity: number;
    category: PurchaseCategory;
    position: number;
  }>;
};

@Injectable()
export class GatheringsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateGatheringDto) {
    const slug = `${this.slugify(dto.title)}-${randomBytes(3).toString("hex")}`;
    const dailyStartMinutes = dto.dailyStartMinutes ?? 780;
    const dailyEndMinutes = dto.dailyEndMinutes ?? 1440;
    const durationMinutes = dto.durationMinutes ?? 180;
    const slotStepMinutes = dto.slotStepMinutes ?? 480;

    if (dailyEndMinutes - dailyStartMinutes < durationMinutes) {
      throw new BadRequestException(
        "La franja horaria debe permitir al menos una opción completa",
      );
    }

    return this.prisma.gathering.create({
      data: {
        slug,
        title: dto.title,
        organizerName: dto.organizerName,
        locationHint: dto.locationHint,
        locationLatitude: dto.locationLatitude,
        locationLongitude: dto.locationLongitude,
        windowStart: new Date(dto.windowStart),
        windowEnd: new Date(dto.windowEnd),
        durationMinutes,
        dailyStartMinutes,
        dailyEndMinutes,
        slotStepMinutes,
        participants: {
          create: {
            name: dto.organizerName,
            avatarUrl: dto.organizerAvatarUrl,
            isOrganizer: true,
          },
        },
      },
      include: { participants: true },
    });
  }

  async getBySlug(slug: string) {
    const gathering = await this.prisma.gathering.findUnique({
      where: { slug },
      include: {
        participants: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            isOrganizer: true,
            expensesReadyAt: true,
            createdAt: true,
            availabilities: true,
          },
          orderBy: { createdAt: "asc" },
        },
        proposals: { orderBy: { score: "desc" } },
      },
    });

    if (!gathering) throw new NotFoundException("Juntada no encontrada");
    return gathering;
  }

  async addParticipant(gatheringId: string, dto: AddParticipantDto) {
    await this.ensureGathering(gatheringId);
    return this.prisma.participant.create({
      data: {
        gatheringId,
        name: dto.name,
        contact: dto.contact,
        avatarUrl: dto.avatarUrl,
      },
    });
  }

  async addGoogleParticipant(
    gatheringId: string,
    dto: GoogleParticipantDto,
  ) {
    await this.ensureGathering(gatheringId);
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new BadRequestException("El acceso con Google no está configurado");
    }

    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(dto.credential)}`,
    );
    if (!response.ok) {
      throw new UnauthorizedException("Google no pudo validar tu identidad");
    }
    const profile = (await response.json()) as {
      aud?: string;
      sub?: string;
      name?: string;
      email?: string;
      picture?: string;
      email_verified?: string;
    };
    if (
      profile.aud !== clientId ||
      !profile.sub ||
      !profile.name ||
      profile.email_verified !== "true"
    ) {
      throw new UnauthorizedException("La identidad de Google no es válida");
    }

    const existing = await this.prisma.participant.findUnique({
      where: {
        gatheringId_googleSubject: {
          gatheringId,
          googleSubject: profile.sub,
        },
      },
    });
    if (existing) return existing;

    return this.prisma.participant.create({
      data: {
        gatheringId,
        googleSubject: profile.sub,
        name: profile.name,
        contact: profile.email,
        avatarUrl: profile.picture,
      },
    });
  }

  async setAvailability(
    gatheringId: string,
    participantId: string,
    participantToken: string | undefined,
    dto: SetAvailabilityDto,
  ) {
    const participant = await this.prisma.participant.findFirst({
      where: { id: participantId, gatheringId },
      include: { gathering: true },
    });
    if (!participant) throw new NotFoundException("Participante no encontrado");
    if (!participantToken || participant.responseToken !== participantToken) {
      throw new UnauthorizedException("No podés editar esta disponibilidad");
    }

    const slots = dto.slots.map((slot) => ({
      participantId,
      startsAt: new Date(slot.startsAt),
      endsAt: new Date(slot.endsAt),
      kind: slot.kind,
    }));
    const invalidSlot = slots.some(
      (slot) =>
        slot.startsAt >= slot.endsAt ||
        slot.startsAt < participant.gathering.windowStart ||
        slot.endsAt > participant.gathering.windowEnd,
    );
    if (invalidSlot) {
      throw new BadRequestException(
        "Los horarios deben estar dentro del rango de la juntada",
      );
    }

    await this.prisma.$transaction([
      this.prisma.availability.deleteMany({ where: { participantId } }),
      this.prisma.availability.createMany({
        data: slots,
      }),
    ]);

    return this.prisma.participant.findUnique({
      where: { id: participantId },
      include: { availabilities: true },
    });
  }

  async getMatches(gatheringId: string) {
    const gathering = await this.prisma.gathering.findUnique({
      where: { id: gatheringId },
      include: {
        participants: { include: { availabilities: true } },
      },
    });
    if (!gathering) throw new NotFoundException("Juntada no encontrada");

    const candidates = new Map<
      string,
      {
        startsAt: Date;
        endsAt: Date;
        availableParticipantIds: Set<string>;
        maybeParticipantIds: Set<string>;
      }
    >();

    for (const participant of gathering.participants) {
      for (const slot of participant.availabilities) {
        const key = `${slot.startsAt.toISOString()}_${slot.endsAt.toISOString()}`;
        const candidate = candidates.get(key) ?? {
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          availableParticipantIds: new Set<string>(),
          maybeParticipantIds: new Set<string>(),
        };
        if (slot.kind === AvailabilityKind.AVAILABLE) {
          candidate.availableParticipantIds.add(participant.id);
        }
        if (slot.kind === AvailabilityKind.MAYBE) {
          candidate.maybeParticipantIds.add(participant.id);
        }
        candidates.set(key, candidate);
      }
    }

    const total = gathering.participants.length;
    return [...candidates.values()]
      .map((candidate) => {
        const availableParticipants = gathering.participants.filter(
          (participant) =>
            candidate.availableParticipantIds.has(participant.id),
        );
        const maybeParticipants = gathering.participants.filter((participant) =>
          candidate.maybeParticipantIds.has(participant.id),
        );
        const missingParticipants = gathering.participants.filter(
          (participant) =>
            !candidate.availableParticipantIds.has(participant.id) &&
            !candidate.maybeParticipantIds.has(participant.id),
        );
        const pendingParticipants = missingParticipants.filter(
          (participant) => participant.availabilities.length === 0,
        );
        const conflictParticipants = missingParticipants.filter(
          (participant) => participant.availabilities.length > 0,
        );
        const available = availableParticipants.length;
        const maybe = maybeParticipants.length;

        return {
          startsAt: candidate.startsAt,
          endsAt: candidate.endsAt,
          available,
          maybe,
          total,
          missing: missingParticipants.length,
          score: total === 0 ? 0 : (available + maybe * 0.5) / total,
          availableParticipantNames: availableParticipants.map(
            (participant) => participant.name,
          ),
          maybeParticipantNames: maybeParticipants.map(
            (participant) => participant.name,
          ),
          missingParticipantNames: missingParticipants.map(
            (participant) => participant.name,
          ),
          pendingParticipantNames: pendingParticipants.map(
            (participant) => participant.name,
          ),
          conflictParticipantNames: conflictParticipants.map(
            (participant) => participant.name,
          ),
          explanation:
            available === total
              ? "Pueden todos"
              : `${available} confirmados y ${missingParticipants.length} por resolver`,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  async getPurchasePlan(gatheringId: string) {
    const gathering = await this.prisma.gathering.findUnique({
      where: { id: gatheringId },
      select: {
        _count: { select: { participants: true } },
        purchasePlan: {
          include: { items: { orderBy: { position: "asc" } } },
        },
      },
    });
    if (!gathering) throw new NotFoundException("Juntada no encontrada");

    return this.serializePurchasePlan(
      gathering._count.participants,
      gathering.purchasePlan,
    );
  }

  async updatePurchasePlan(
    gatheringId: string,
    participantId: string,
    participantToken: string | undefined,
    dto: UpdatePurchasePlanDto,
  ) {
    const participant = await this.prisma.participant.findFirst({
      where: { id: participantId, gatheringId },
      include: {
        gathering: { select: { _count: { select: { participants: true } } } },
      },
    });
    if (!participant) throw new NotFoundException("Participante no encontrado");
    if (!participantToken || participant.responseToken !== participantToken) {
      throw new UnauthorizedException("No podés editar esta compra");
    }
    if (!participant.isOrganizer) {
      throw new UnauthorizedException(
        "Sólo quien organiza puede editar la compra",
      );
    }

    const quantities = new Map<string, number>();
    for (const item of dto.items) {
      if (quantities.has(item.key)) {
        throw new BadRequestException("La compra contiene productos repetidos");
      }
      quantities.set(item.key, item.quantity);
    }
    const catalogKeys = new Set(purchaseCatalog.map((item) => item.key));
    if ([...quantities.keys()].some((key) => !catalogKeys.has(key))) {
      throw new BadRequestException("La compra contiene un producto inválido");
    }

    const participantCount = participant.gathering._count.participants;
    const plan = await this.prisma.$transaction(async (transaction) => {
      const savedPlan = await transaction.purchasePlan.upsert({
        where: { gatheringId },
        create: {
          gatheringId,
          includeAlcohol: dto.includeAlcohol,
          ageConfirmed: dto.includeAlcohol && dto.ageConfirmed,
          participantBaseline: participantCount,
          updatedByParticipantId: participant.id,
        },
        update: {
          includeAlcohol: dto.includeAlcohol,
          ageConfirmed: dto.includeAlcohol && dto.ageConfirmed,
          participantBaseline: participantCount,
          updatedByParticipantId: participant.id,
        },
      });

      await Promise.all(
        purchaseCatalog.map((item, position) => {
          const quantity =
            quantities.get(item.key) ?? item.suggest(participantCount);
          return transaction.purchaseItem.upsert({
            where: {
              purchasePlanId_key: {
                purchasePlanId: savedPlan.id,
                key: item.key,
              },
            },
            create: {
              purchasePlanId: savedPlan.id,
              key: item.key,
              label: item.label,
              unit: item.unit,
              quantity,
              category: item.category,
              position,
            },
            update: {
              label: item.label,
              unit: item.unit,
              quantity,
              category: item.category,
              position,
            },
          });
        }),
      );

      return transaction.purchasePlan.findUniqueOrThrow({
        where: { id: savedPlan.id },
        include: { items: { orderBy: { position: "asc" } } },
      });
    });

    return this.serializePurchasePlan(participantCount, plan);
  }

  async addExpense(
    gatheringId: string,
    participantId: string,
    participantToken: string | undefined,
    dto: AddExpenseDto,
  ) {
    const participant = await this.prisma.participant.findFirst({
      where: { id: participantId, gatheringId },
    });
    if (!participant) throw new NotFoundException("Participante no encontrado");
    if (!participantToken || participant.responseToken !== participantToken) {
      throw new UnauthorizedException("No podés cargar gastos por otra persona");
    }

    return this.prisma.$transaction(async (transaction) => {
      const state = await transaction.gathering.findUnique({
        where: { id: gatheringId },
        select: {
          expenseRound: true,
          participants: { select: { expensesReadyAt: true } },
          _count: { select: { expenses: true } },
        },
      });
      const wasClosed =
        (state?.participants.length ?? 0) > 0 &&
        state?.participants.every(
          (candidate) => candidate.expensesReadyAt !== null,
        ) &&
        (state?._count.expenses ?? 0) > 0;
      if (wasClosed) {
        await transaction.gathering.update({
          where: { id: gatheringId },
          data: { expenseRound: { increment: 1 } },
        });
      }
      await transaction.participant.updateMany({
        where: { gatheringId },
        data: { expensesReadyAt: null },
      });
      return transaction.expense.create({
        data: {
          gatheringId,
          paidByParticipantId: participantId,
          description: dto.description.trim(),
          amountCents: dto.amountCents,
        },
        include: {
          paidBy: { select: { id: true, name: true, avatarUrl: true } },
        },
      });
    });
  }

  async getExpenseSettlement(gatheringId: string) {
    const gathering = await this.prisma.gathering.findUnique({
      where: { id: gatheringId },
      include: {
        participants: { orderBy: { createdAt: "asc" } },
        expenses: {
          include: {
            paidBy: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        transferConfirmations: true,
      },
    });
    if (!gathering) throw new NotFoundException("Juntada no encontrada");

    const totalCents = gathering.expenses.reduce(
      (total, expense) => total + expense.amountCents,
      0,
    );
    const participantCount = gathering.participants.length;
    const readyParticipants = gathering.participants
      .filter((participant) => participant.expensesReadyAt !== null)
      .map((participant) => ({
        participantId: participant.id,
        name: participant.name,
      }));
    const pendingReadyParticipants = gathering.participants
      .filter((participant) => participant.expensesReadyAt === null)
      .map((participant) => ({
        participantId: participant.id,
        name: participant.name,
      }));
    const allReady =
      participantCount > 0 && readyParticipants.length === participantCount;
    const participantNames = new Map(
      gathering.participants.map((participant) => [
        participant.id,
        participant.name,
      ]),
    );
    const completedTransfers = gathering.transferConfirmations.map(
      (confirmation) => ({
        id: confirmation.id,
        fromParticipantId: confirmation.fromParticipantId,
        fromName:
          participantNames.get(confirmation.fromParticipantId) ?? "Participante",
        toParticipantId: confirmation.toParticipantId,
        toName:
          participantNames.get(confirmation.toParticipantId) ?? "Participante",
        amountCents: confirmation.amountCents,
        confirmedAt: confirmation.confirmedAt,
      }),
    );
    if (participantCount === 0) {
      return {
        totalCents,
        participantCount,
        averageCents: 0,
        expenseRound: gathering.expenseRound,
        expenses: gathering.expenses,
        balances: [],
        transfers: [],
        completedTransfers,
        readyParticipants,
        pendingReadyParticipants,
        allReady,
      };
    }

    const baseShare = Math.floor(totalCents / participantCount);
    const remainder = totalCents % participantCount;
    const paidByParticipant = new Map<string, number>();
    for (const expense of gathering.expenses) {
      paidByParticipant.set(
        expense.paidByParticipantId,
        (paidByParticipant.get(expense.paidByParticipantId) ?? 0) +
          expense.amountCents,
      );
    }

    const balances = gathering.participants.map((participant, index) => {
      const owedCents = baseShare + (index < remainder ? 1 : 0);
      const paidCents = paidByParticipant.get(participant.id) ?? 0;
      return {
        participantId: participant.id,
        name: participant.name,
        paidCents,
        owedCents,
        balanceCents: paidCents - owedCents,
      };
    });
    const balancesByParticipant = new Map(
      balances.map((balance) => [balance.participantId, balance]),
    );
    for (const confirmation of gathering.transferConfirmations) {
      const sender = balancesByParticipant.get(confirmation.fromParticipantId);
      const receiver = balancesByParticipant.get(confirmation.toParticipantId);
      if (sender) sender.balanceCents += confirmation.amountCents;
      if (receiver) receiver.balanceCents -= confirmation.amountCents;
    }
    const debtors = balances
      .filter((balance) => balance.balanceCents < 0)
      .map((balance) => ({
        participantId: balance.participantId,
        name: balance.name,
        amountCents: -balance.balanceCents,
      }));
    const creditors = balances
      .filter((balance) => balance.balanceCents > 0)
      .map((balance) => ({
        participantId: balance.participantId,
        name: balance.name,
        amountCents: balance.balanceCents,
      }));
    const transfers: Array<{
      id: string;
      fromParticipantId: string;
      fromName: string;
      toParticipantId: string;
      toName: string;
      amountCents: number;
      settled: boolean;
    }> = [];

    let debtorIndex = 0;
    let creditorIndex = 0;
    while (
      debtorIndex < debtors.length &&
      creditorIndex < creditors.length
    ) {
      const debtor = debtors[debtorIndex];
      const creditor = creditors[creditorIndex];
      const amountCents = Math.min(
        debtor.amountCents,
        creditor.amountCents,
      );
      const id = this.transferKey(
        debtor.participantId,
        creditor.participantId,
        amountCents,
      );
      transfers.push({
        id,
        fromParticipantId: debtor.participantId,
        fromName: debtor.name,
        toParticipantId: creditor.participantId,
        toName: creditor.name,
        amountCents,
        settled: false,
      });
      debtor.amountCents -= amountCents;
      creditor.amountCents -= amountCents;
      if (debtor.amountCents === 0) debtorIndex += 1;
      if (creditor.amountCents === 0) creditorIndex += 1;
    }

    return {
      totalCents,
      participantCount,
      averageCents: Math.round(totalCents / participantCount),
      expenseRound: gathering.expenseRound,
      expenses: gathering.expenses,
      balances,
      transfers,
      completedTransfers,
      readyParticipants,
      pendingReadyParticipants,
      allReady,
    };
  }

  async markExpensesReady(
    gatheringId: string,
    participantId: string,
    participantToken: string | undefined,
  ) {
    const participant = await this.prisma.participant.findFirst({
      where: { id: participantId, gatheringId },
    });
    if (!participant) throw new NotFoundException("Participante no encontrado");
    if (!participantToken || participant.responseToken !== participantToken) {
      throw new UnauthorizedException("No podés confirmar por otra persona");
    }

    return this.prisma.participant.update({
      where: { id: participantId },
      data: { expensesReadyAt: new Date() },
      select: { id: true, name: true, expensesReadyAt: true },
    });
  }

  async confirmTransfer(
    gatheringId: string,
    participantId: string,
    participantToken: string | undefined,
    dto: ConfirmTransferDto,
  ) {
    const participant = await this.prisma.participant.findFirst({
      where: { id: participantId, gatheringId },
    });
    if (!participant) throw new NotFoundException("Participante no encontrado");
    if (!participantToken || participant.responseToken !== participantToken) {
      throw new UnauthorizedException("No podés confirmar esta transferencia");
    }

    const settlement = await this.getExpenseSettlement(gatheringId);
    if (!settlement.allReady) {
      throw new BadRequestException(
        "El grupo todavía no terminó de cargar todos los gastos",
      );
    }
    const transfer = settlement.transfers.find(
      (candidate) =>
        candidate.fromParticipantId === participantId &&
        candidate.toParticipantId === dto.toParticipantId &&
        candidate.amountCents === dto.amountCents,
    );
    if (!transfer) {
      throw new BadRequestException(
        "La transferencia ya no coincide con la división actual",
      );
    }

    return this.prisma.transferConfirmation.upsert({
      where: {
        gatheringId_fromParticipantId_toParticipantId_amountCents: {
          gatheringId,
          fromParticipantId: participantId,
          toParticipantId: dto.toParticipantId,
          amountCents: dto.amountCents,
        },
      },
      create: {
        gatheringId,
        fromParticipantId: participantId,
        toParticipantId: dto.toParticipantId,
        amountCents: dto.amountCents,
      },
      update: { confirmedAt: new Date() },
      include: {
        fromParticipant: { select: { id: true, name: true } },
        toParticipant: { select: { id: true, name: true } },
      },
    });
  }

  private async ensureGathering(id: string) {
    const gathering = await this.prisma.gathering.findUnique({ where: { id } });
    if (!gathering) throw new NotFoundException("Juntada no encontrada");
  }

  private slugify(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48);
  }

  private transferKey(
    fromParticipantId: string,
    toParticipantId: string,
    amountCents: number,
  ) {
    return `${fromParticipantId}:${toParticipantId}:${amountCents}`;
  }

  private serializePurchasePlan(
    participantCount: number,
    plan: StoredPurchasePlan | null,
  ) {
    const storedItems = new Map(
      plan?.items.map((item) => [item.key, item]) ?? [],
    );
    return {
      id: plan?.id ?? null,
      persisted: Boolean(plan),
      includeAlcohol: plan?.includeAlcohol ?? false,
      ageConfirmed: plan?.ageConfirmed ?? false,
      participantCount,
      participantBaseline: plan?.participantBaseline ?? participantCount,
      updatedAt: plan?.updatedAt ?? null,
      items: purchaseCatalog.map((item, position) => {
        const stored = storedItems.get(item.key);
        return {
          key: item.key,
          label: item.label,
          unit: item.unit,
          category: item.category.toLowerCase(),
          position,
          quantity: stored?.quantity ?? item.suggest(participantCount),
          suggestedQuantity: item.suggest(participantCount),
        };
      }),
    };
  }
}
