import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  AvailabilityKind,
  GatheringStatus,
  Prisma,
  PurchaseCategory,
} from "@prisma/client";
import { randomBytes } from "node:crypto";
import type { AuthIdentity } from "../auth/supabase-auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { AddExpenseDto } from "./dto/add-expense.dto";
import { AddParticipantDto } from "./dto/add-participant.dto";
import { AuthParticipantDto } from "./dto/auth-participant.dto";
import { ConfirmTransferDto } from "./dto/confirm-transfer.dto";
import { CreateGatheringDto } from "./dto/create-gathering.dto";
import { FinalizeGatheringDto } from "./dto/finalize-gathering.dto";
import { GoogleParticipantDto } from "./dto/google-participant.dto";
import { SetAvailabilityDto } from "./dto/set-availability.dto";
import { UpdateDietaryProfileDto } from "./dto/update-dietary-profile.dto";
import { UpdateExpenseDto } from "./dto/update-expense.dto";
import { UpdateGatheringDto } from "./dto/update-gathering.dto";
import { UpdatePaymentAliasDto } from "./dto/update-payment-alias.dto";
import { UpdatePurchasePlanDto } from "./dto/update-purchase-plan.dto";
import { UpdatePurchaseContributionStatusDto } from "./dto/update-purchase-contribution-status.dto";
import { UpsertPurchaseContributionDto } from "./dto/upsert-purchase-contribution.dto";
import {
  type PurchaseResponsibilityAction,
  UpdatePurchaseResponsibilityDto,
} from "./dto/update-purchase-responsibility.dto";
import { buildSlots, isValidTimeZone } from "./slots";

/** Zona de las juntadas ya creadas y de las nuevas que no declaren otra. */
export const DEFAULT_TIME_ZONE = "America/Argentina/Buenos_Aires";

/**
 * Tope de participantes por juntada. El link es público por diseño, así que
 * sin un límite cualquiera puede inflar el grupo — y como los gastos y la
 * compra se dividen por cabeza, sumar gente falsa cambia lo que paga y lo
 * que le toca llevar a cada uno.
 */
export const MAX_PARTICIPANTS = 40;

type PurchaseCatalogItem = {
  key: string;
  label: string;
  unit: string;
  category: PurchaseCategory;
  suggest(people: number): number;
};

const purchaseCatalog: PurchaseCatalogItem[] = [
  {
    key: "meat",
    label: "Comida principal",
    unit: "aportes",
    category: PurchaseCategory.FOOD,
    suggest: () => 1,
  },
  {
    key: "salad",
    label: "Acompañamientos",
    unit: "aportes",
    category: PurchaseCategory.FOOD,
    suggest: () => 1,
  },
  {
    key: "snacks",
    label: "Snacks",
    unit: "aportes",
    category: PurchaseCategory.FOOD,
    suggest: () => 1,
  },
  {
    key: "dessert",
    label: "Postre",
    unit: "aportes",
    category: PurchaseCategory.FOOD,
    suggest: () => 1,
  },
  {
    key: "soda",
    label: "Gaseosas y bebidas sin alcohol",
    unit: "aportes",
    category: PurchaseCategory.DRINKS,
    suggest: () => 1,
  },
  {
    key: "ice",
    label: "Hielo",
    unit: "bolsas",
    category: PurchaseCategory.OTHER,
    suggest: () => 1,
  },
  {
    key: "charcoal",
    label: "Parrilla y fuego",
    unit: "aportes",
    category: PurchaseCategory.OTHER,
    suggest: () => 1,
  },
  {
    key: "beer",
    label: "Bebidas con alcohol",
    unit: "aportes",
    category: PurchaseCategory.ALCOHOL,
    suggest: () => 1,
  },
  {
    key: "other",
    label: "Otros",
    unit: "aportes",
    category: PurchaseCategory.OTHER,
    suggest: () => 1,
  },
];

const legacyPurchaseKeys = new Set(["bread", "water", "fernet", "wine"]);

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
    assignedParticipantId: string | null;
    assignedAt: Date | null;
    isReady: boolean;
    assignee: {
      id: string;
      name: string;
      avatarUrl: string | null;
    } | null;
    contributions: Array<{
      id: string;
      catalogProductId: string | null;
      catalogPresentationId: string | null;
      description: string;
      quantity: number;
      unit: string;
      note: string | null;
      isReady: boolean;
      createdAt: Date;
      updatedAt: Date;
      participant: {
        id: string;
        name: string;
        avatarUrl: string | null;
      };
    }>;
  }>;
};

@Injectable()
export class GatheringsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPurchaseCatalog() {
    const products = await this.prisma.catalogProduct.findMany({
      where: { isActive: true },
      orderBy: [{ categoryKey: "asc" }, { position: "asc" }, { name: "asc" }],
      select: {
        id: true,
        key: true,
        categoryKey: true,
        name: true,
        brand: true,
        description: true,
        visualKey: true,
        accentColor: true,
        tags: true,
        isAlcohol: true,
        presentations: {
          where: { isActive: true },
          orderBy: [{ position: "asc" }, { label: "asc" }],
          select: { id: true, key: true, label: true, unit: true },
        },
      },
    });
    return { version: 1, products };
  }

  async create(dto: CreateGatheringDto, identity: AuthIdentity | null = null) {
    // 8 bytes en vez de 3: el slug es la única barrera que protege nombres,
    // fotos, disponibilidad, gastos y la ubicación exacta del encuentro.
    const slug = `${this.slugify(dto.title)}-${randomBytes(8).toString("hex")}`;
    const dailyStartMinutes = dto.dailyStartMinutes ?? 780;
    const dailyEndMinutes = dto.dailyEndMinutes ?? 1440;
    const durationMinutes = dto.durationMinutes ?? 180;
    const slotStepMinutes = dto.slotStepMinutes ?? 480;
    const timeZone = dto.timeZone ?? DEFAULT_TIME_ZONE;

    if (dailyEndMinutes - dailyStartMinutes < durationMinutes) {
      throw new BadRequestException(
        "La franja horaria debe permitir al menos una opción completa",
      );
    }
    if (!isValidTimeZone(timeZone)) {
      throw new BadRequestException("La zona horaria no es válida");
    }

    if (dto.templateGatheringId && !identity) {
      throw new UnauthorizedException(
        "Necesitás ingresar para duplicar una juntada",
      );
    }

    return this.prisma.$transaction(async (transaction) => {
      const paymentProfile = identity
        ? await transaction.userPaymentProfile.findUnique({
            where: { authUserId: identity.id },
            select: { paymentAlias: true },
          })
        : null;
      const template = dto.templateGatheringId
        ? await transaction.gathering.findFirst({
            where: {
              id: dto.templateGatheringId,
              participants: {
                some: {
                  authUserId: identity!.id,
                  isOrganizer: true,
                },
              },
            },
            select: {
              description: true,
              purchasePlan: {
                select: {
                  participantBaseline: true,
                  items: {
                    select: {
                      key: true,
                      label: true,
                      unit: true,
                      quantity: true,
                      category: true,
                      position: true,
                    },
                    orderBy: { position: "asc" },
                  },
                },
              },
            },
          })
        : null;

      if (dto.templateGatheringId && !template) {
        throw new ForbiddenException(
          "Sólo quien organiza puede duplicar esta juntada",
        );
      }

      const gathering = await transaction.gathering.create({
        data: {
          slug,
          title: dto.title,
          description: template?.description,
          organizerName: dto.organizerName,
          locationHint: dto.locationHint,
          locationLatitude: dto.locationLatitude,
          locationLongitude: dto.locationLongitude,
          timeZone,
          windowStart: new Date(dto.windowStart),
          windowEnd: new Date(dto.windowEnd),
          durationMinutes,
          dailyStartMinutes,
          dailyEndMinutes,
          slotStepMinutes,
          participants: {
            create: {
              name: dto.organizerName,
              contact: identity?.email,
              avatarUrl: dto.organizerAvatarUrl,
              authUserId: identity?.id,
              paymentAlias: paymentProfile?.paymentAlias,
              isOrganizer: true,
            },
          },
        },
        include: { participants: true },
      });

      if (template?.purchasePlan) {
        await transaction.purchasePlan.create({
          data: {
            gatheringId: gathering.id,
            includeAlcohol: false,
            ageConfirmed: false,
            participantBaseline: template.purchasePlan.participantBaseline,
            items: {
              create: template.purchasePlan.items.map((item) => ({
                key: item.key,
                label: item.label,
                unit: item.unit,
                quantity: item.quantity,
                category: item.category,
                position: item.position,
              })),
            },
          },
        });
      }

      return gathering;
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
            dietaryPreferences: true,
            mealArrangement: true,
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
    // Los horarios candidatos viajan calculados en la zona de la juntada: son
    // los mismos instantes para todo el grupo, sin importar desde dónde abran
    // el link.
    return { ...gathering, slots: this.slotsFor(gathering) };
  }

  /** Horarios que esta juntada ofrece, calculados en su propia zona horaria. */
  private slotsFor(gathering: {
    windowStart: Date;
    windowEnd: Date;
    timeZone: string;
    durationMinutes: number;
    dailyStartMinutes: number;
    dailyEndMinutes: number;
    slotStepMinutes: number;
  }) {
    return buildSlots({
      windowStart: gathering.windowStart,
      windowEnd: gathering.windowEnd,
      timeZone: gathering.timeZone,
      durationMinutes: gathering.durationMinutes,
      dailyStartMinutes: gathering.dailyStartMinutes,
      dailyEndMinutes: gathering.dailyEndMinutes,
      slotStepMinutes: gathering.slotStepMinutes,
    });
  }

  async finalizeGathering(
    gatheringId: string,
    participantId: string,
    participantToken: string | undefined,
    dto: FinalizeGatheringDto,
  ) {
    const organizer = await this.requireOrganizer(
      gatheringId,
      participantId,
      participantToken,
    );
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    const gathering = organizer.gathering;

    if (gathering.status === GatheringStatus.CANCELLED) {
      throw new ConflictException("La juntada está cancelada");
    }
    if (
      startsAt < gathering.windowStart ||
      endsAt > gathering.windowEnd ||
      startsAt >= endsAt ||
      endsAt.getTime() - startsAt.getTime() !==
        gathering.durationMinutes * 60_000
    ) {
      throw new BadRequestException(
        "La fecha elegida no pertenece a las opciones de la juntada",
      );
    }

    await this.prisma.gathering.update({
      where: { id: gatheringId },
      data: {
        status: GatheringStatus.CONFIRMED,
        finalizedStart: startsAt,
        finalizedEnd: endsAt,
        finalizedLocation:
          dto.location?.trim() || gathering.locationHint || null,
      },
    });
    return this.getBySlug(gathering.slug);
  }

  async updateGathering(
    gatheringId: string,
    participantId: string,
    participantToken: string | undefined,
    dto: UpdateGatheringDto,
  ) {
    const organizer = await this.requireOrganizer(
      gatheringId,
      participantId,
      participantToken,
    );
    const current = organizer.gathering;
    if (current.status === GatheringStatus.CANCELLED) {
      throw new ConflictException("La juntada está cancelada");
    }

    const windowStart = dto.windowStart
      ? new Date(dto.windowStart)
      : current.windowStart;
    const windowEnd = dto.windowEnd ? new Date(dto.windowEnd) : current.windowEnd;
    const durationMinutes = dto.durationMinutes ?? current.durationMinutes;
    const dailyStartMinutes =
      dto.dailyStartMinutes ?? current.dailyStartMinutes;
    const dailyEndMinutes = dto.dailyEndMinutes ?? current.dailyEndMinutes;
    const slotStepMinutes = dto.slotStepMinutes ?? current.slotStepMinutes;

    if (windowStart >= windowEnd) {
      throw new BadRequestException("El rango de fechas no es válido");
    }
    if (dailyEndMinutes - dailyStartMinutes < durationMinutes) {
      throw new BadRequestException(
        "La franja horaria debe permitir al menos una opción completa",
      );
    }

    const scheduleChanged =
      windowStart.getTime() !== current.windowStart.getTime() ||
      windowEnd.getTime() !== current.windowEnd.getTime() ||
      durationMinutes !== current.durationMinutes ||
      dailyStartMinutes !== current.dailyStartMinutes ||
      dailyEndMinutes !== current.dailyEndMinutes ||
      slotStepMinutes !== current.slotStepMinutes;
    const locationHint = dto.locationHint?.trim();
    const locationChanged =
      dto.locationHint !== undefined && locationHint !== current.locationHint;

    await this.prisma.$transaction(async (transaction) => {
      if (scheduleChanged) {
        await transaction.availability.deleteMany({
          where: { participant: { gatheringId } },
        });
        await transaction.proposal.deleteMany({ where: { gatheringId } });
      }
      await transaction.gathering.update({
        where: { id: gatheringId },
        data: {
          title: dto.title?.trim() ?? current.title,
          locationHint:
            dto.locationHint === undefined ? current.locationHint : locationHint || null,
          locationLatitude: locationChanged ? null : current.locationLatitude,
          locationLongitude: locationChanged ? null : current.locationLongitude,
          windowStart,
          windowEnd,
          durationMinutes,
          dailyStartMinutes,
          dailyEndMinutes,
          slotStepMinutes,
          ...(scheduleChanged
            ? {
                status: GatheringStatus.OPEN,
                finalizedStart: null,
                finalizedEnd: null,
                finalizedLocation: null,
              }
            : {}),
        },
      });
    });

    return this.getBySlug(current.slug);
  }

  async cancelGathering(
    gatheringId: string,
    participantId: string,
    participantToken: string | undefined,
  ) {
    const organizer = await this.requireOrganizer(
      gatheringId,
      participantId,
      participantToken,
    );
    await this.prisma.gathering.update({
      where: { id: gatheringId },
      data: {
        status: GatheringStatus.CANCELLED,
        finalizedStart: null,
        finalizedEnd: null,
        finalizedLocation: null,
      },
    });
    return this.getBySlug(organizer.gathering.slug);
  }

  async addParticipant(gatheringId: string, dto: AddParticipantDto) {
    await this.ensureGathering(gatheringId);
    const name = dto.name.trim();

    // Quien borra los datos del navegador (o abre el link en otro
    // dispositivo) no queda reconocido y la app le ofrece sumarse de nuevo.
    // Como los gastos se dividen por cabeza, ese duplicado le cambia la
    // cuenta a todo el grupo: se frena y se le pregunta si es la misma
    // persona, salvo que ya haya confirmado que son dos personas distintas.
    if (!dto.allowDuplicateName) {
      const existing = await this.prisma.participant.findFirst({
        where: { gatheringId, name: { equals: name, mode: "insensitive" } },
        select: { id: true },
      });
      if (existing) {
        throw new BadRequestException(
          `Ya hay alguien anotado como “${name}” en esta juntada. Si sos vos, recuperá tu acceso; si no, entrá con otro nombre.`,
        );
      }
    }
    await this.ensureParticipantCapacity(gatheringId);

    return this.prisma.participant.create({
      data: {
        gatheringId,
        name,
        contact: dto.contact,
        avatarUrl: dto.avatarUrl,
      },
    });
  }

  async addGoogleParticipant(gatheringId: string, dto: GoogleParticipantDto) {
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
    await this.ensureParticipantCapacity(gatheringId);

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
    if (participant.gathering.status === GatheringStatus.CANCELLED) {
      throw new ConflictException("La juntada está cancelada");
    }
    if (participant.gathering.status === GatheringStatus.CONFIRMED) {
      throw new ConflictException("La fecha de la juntada ya está confirmada");
    }

    const slots = dto.slots.map((slot) => ({
      participantId,
      startsAt: new Date(slot.startsAt),
      endsAt: new Date(slot.endsAt),
      kind: slot.kind,
    }));
    // Se aceptan únicamente los horarios que la juntada realmente ofrece. El
    // matching agrupa por instante exacto, así que un horario que no esté en la
    // grilla quedaría aislado para siempre en vez de cruzar con el del resto.
    const offered = new Set(
      this.slotsFor(participant.gathering).map(
        (slot) => `${slot.startsAt}_${slot.endsAt}`,
      ),
    );
    const invalidSlot = slots.some(
      (slot) =>
        !offered.has(
          `${slot.startsAt.toISOString()}_${slot.endsAt.toISOString()}`,
        ),
    );
    if (invalidSlot) {
      throw new BadRequestException(
        "Alguno de los horarios ya no corresponde a esta juntada. Actualizá la página.",
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

  async updateDietaryProfile(
    gatheringId: string,
    participantId: string,
    participantToken: string | undefined,
    dto: UpdateDietaryProfileDto,
  ) {
    const participant = await this.prisma.participant.findFirst({
      where: { id: participantId, gatheringId },
    });
    if (!participant) throw new NotFoundException("Participante no encontrado");
    if (!participantToken || participant.responseToken !== participantToken) {
      throw new UnauthorizedException(
        "No podés editar las preferencias de otra persona",
      );
    }
    if (dto.dietaryPreferences.length > 0 && !dto.mealArrangement) {
      throw new BadRequestException(
        "Elegí si vas a gestionar tu comida o si el grupo debe buscar una opción",
      );
    }

    return this.prisma.participant.update({
      where: { id: participantId },
      data: {
        dietaryPreferences: dto.dietaryPreferences,
        mealArrangement:
          dto.dietaryPreferences.length > 0 ? dto.mealArrangement : null,
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        isOrganizer: true,
        dietaryPreferences: true,
        mealArrangement: true,
        expensesReadyAt: true,
      },
    });
  }

  async getPurchasePlan(gatheringId: string) {
    const gathering = await this.prisma.gathering.findUnique({
      where: { id: gatheringId },
      select: {
        _count: { select: { participants: true } },
        purchasePlan: {
          include: {
            items: {
              orderBy: { position: "asc" },
              include: {
                assignee: {
                  select: { id: true, name: true, avatarUrl: true },
                },
                contributions: {
                  orderBy: { updatedAt: "desc" },
                  include: {
                    participant: {
                      select: { id: true, name: true, avatarUrl: true },
                    },
                  },
                },
              },
            },
          },
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
    if (
      [...quantities.keys()].some(
        (key) => !catalogKeys.has(key) && !legacyPurchaseKeys.has(key),
      )
    ) {
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
          const isActive =
            quantity > 0 &&
            (item.category !== PurchaseCategory.ALCOHOL || dto.includeAlcohol);
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
              ...(!isActive && {
                assignedParticipantId: null,
                assignedAt: null,
                isReady: false,
              }),
            },
          });
        }),
      );

      return transaction.purchasePlan.findUniqueOrThrow({
        where: { id: savedPlan.id },
        include: {
          items: {
            orderBy: { position: "asc" },
            include: {
              assignee: {
                select: { id: true, name: true, avatarUrl: true },
              },
              contributions: {
                orderBy: { updatedAt: "desc" },
                include: {
                  participant: {
                    select: { id: true, name: true, avatarUrl: true },
                  },
                },
              },
            },
          },
        },
      });
    });

    return this.serializePurchasePlan(participantCount, plan);
  }

  async updatePurchaseResponsibility(
    gatheringId: string,
    participantId: string,
    participantToken: string | undefined,
    itemKey: string,
    dto: UpdatePurchaseResponsibilityDto,
  ) {
    const participant = await this.prisma.participant.findFirst({
      where: { id: participantId, gatheringId },
      include: {
        gathering: { select: { _count: { select: { participants: true } } } },
      },
    });
    if (!participant) throw new NotFoundException("Participante no encontrado");
    if (!participantToken || participant.responseToken !== participantToken) {
      throw new UnauthorizedException("No podés elegir por otra persona");
    }

    const catalogItem = purchaseCatalog.find((item) => item.key === itemKey);
    if (!catalogItem) {
      throw new BadRequestException("La compra contiene un producto inválido");
    }

    const participantCount = participant.gathering._count.participants;
    const plan = await this.prisma.$transaction(async (transaction) => {
      const savedPlan = await transaction.purchasePlan.upsert({
        where: { gatheringId },
        create: {
          gatheringId,
          participantBaseline: participantCount,
        },
        update: {},
      });

      if (catalogItem.category === PurchaseCategory.ALCOHOL) {
        if (!savedPlan.includeAlcohol || !savedPlan.ageConfirmed) {
          throw new BadRequestException(
            "El alcohol no está habilitado por quien organiza",
          );
        }
        if (dto.action === "claim" && dto.adultConfirmed !== true) {
          throw new BadRequestException(
            "Confirmá que sos mayor de 18 años para hacerte cargo",
          );
        }
      }

      const item = await transaction.purchaseItem.upsert({
        where: {
          purchasePlanId_key: {
            purchasePlanId: savedPlan.id,
            key: catalogItem.key,
          },
        },
        create: {
          purchasePlanId: savedPlan.id,
          key: catalogItem.key,
          label: catalogItem.label,
          unit: catalogItem.unit,
          quantity: catalogItem.suggest(participantCount),
          category: catalogItem.category,
          position: purchaseCatalog.indexOf(catalogItem),
        },
        update: {
          label: catalogItem.label,
          unit: catalogItem.unit,
          category: catalogItem.category,
          position: purchaseCatalog.indexOf(catalogItem),
        },
      });

      if (item.quantity < 1) {
        throw new BadRequestException(
          "Este producto no está activo en la compra",
        );
      }

      await this.applyPurchaseResponsibilityAction(
        transaction,
        item.id,
        item.assignedParticipantId,
        participant,
        dto.action,
      );

      return transaction.purchasePlan.findUniqueOrThrow({
        where: { id: savedPlan.id },
        include: {
          items: {
            orderBy: { position: "asc" },
            include: {
              assignee: {
                select: { id: true, name: true, avatarUrl: true },
              },
              contributions: {
                orderBy: { updatedAt: "desc" },
                include: {
                  participant: {
                    select: { id: true, name: true, avatarUrl: true },
                  },
                },
              },
            },
          },
        },
      });
    });

    return {
      plan: this.serializePurchasePlan(participantCount, plan),
      activity: {
        action: dto.action,
        itemKey: catalogItem.key,
        itemLabel: catalogItem.label,
        participantId: participant.id,
        participantName: participant.name,
      },
    };
  }

  async upsertPurchaseContribution(
    gatheringId: string,
    participantId: string,
    participantToken: string | undefined,
    itemKey: string,
    dto: UpsertPurchaseContributionDto,
  ) {
    const participant = await this.requirePurchaseParticipant(
      gatheringId,
      participantId,
      participantToken,
    );
    const catalogItem = purchaseCatalog.find((item) => item.key === itemKey);
    if (!catalogItem) {
      throw new BadRequestException("La categoría de compra no es válida");
    }
    const catalogProduct = dto.catalogProductId
      ? await this.prisma.catalogProduct.findFirst({
          where: {
            id: dto.catalogProductId,
            categoryKey: itemKey,
            isActive: true,
          },
        })
      : null;
    if (dto.catalogProductId && !catalogProduct) {
      throw new BadRequestException(
        "Ese producto no pertenece a esta categoría",
      );
    }
    const catalogPresentation = dto.catalogPresentationId
      ? await this.prisma.catalogPresentation.findFirst({
          where: {
            id: dto.catalogPresentationId,
            productId: catalogProduct?.id ?? "",
            isActive: true,
          },
        })
      : null;
    if (dto.catalogPresentationId && !catalogPresentation) {
      throw new BadRequestException(
        "La presentación no pertenece al producto elegido",
      );
    }
    if (catalogProduct && !catalogPresentation) {
      throw new BadRequestException("Elegí una presentación para el producto");
    }

    const description = catalogProduct?.name ?? dto.description?.trim() ?? "";
    const unit = catalogPresentation?.unit ?? dto.unit?.trim() ?? "";
    if (description.length < 2) {
      throw new BadRequestException("Contanos qué vas a llevar");
    }
    if (!unit) {
      throw new BadRequestException("Indicá la presentación del aporte");
    }

    await this.prisma.$transaction(async (transaction) => {
      const plan = await transaction.purchasePlan.upsert({
        where: { gatheringId },
        create: {
          gatheringId,
          participantBaseline: participant.gathering._count.participants,
        },
        update: {},
      });
      if (catalogItem.category === PurchaseCategory.ALCOHOL) {
        if (!plan.includeAlcohol || !plan.ageConfirmed) {
          throw new BadRequestException(
            "Las bebidas con alcohol no están habilitadas por quien organiza",
          );
        }
        if (dto.adultConfirmed !== true) {
          throw new BadRequestException(
            "Confirmá que sos mayor de 18 años para sumar este aporte",
          );
        }
      }

      const item = await transaction.purchaseItem.upsert({
        where: {
          purchasePlanId_key: {
            purchasePlanId: plan.id,
            key: catalogItem.key,
          },
        },
        create: {
          purchasePlanId: plan.id,
          key: catalogItem.key,
          label: catalogItem.label,
          unit: catalogItem.unit,
          quantity: catalogItem.suggest(
            participant.gathering._count.participants,
          ),
          category: catalogItem.category,
          position: purchaseCatalog.indexOf(catalogItem),
        },
        update: {
          label: catalogItem.label,
          unit: catalogItem.unit,
          category: catalogItem.category,
          position: purchaseCatalog.indexOf(catalogItem),
        },
      });

      await transaction.purchaseContribution.upsert({
        where: {
          purchaseItemId_participantId: {
            purchaseItemId: item.id,
            participantId,
          },
        },
        create: {
          purchaseItemId: item.id,
          participantId,
          catalogProductId: catalogProduct?.id ?? null,
          catalogPresentationId: catalogPresentation?.id ?? null,
          description,
          quantity: dto.quantity,
          unit,
          note: dto.note?.trim() || null,
        },
        update: {
          catalogProductId: catalogProduct?.id ?? null,
          catalogPresentationId: catalogPresentation?.id ?? null,
          description,
          quantity: dto.quantity,
          unit,
          note: dto.note?.trim() || null,
          isReady: false,
        },
      });
    });

    return {
      plan: await this.getPurchasePlan(gatheringId),
      activity: {
        action: "contribute" as const,
        itemKey,
        itemLabel: catalogItem.label,
        participantId,
        participantName: participant.name,
      },
    };
  }

  async updatePurchaseContributionStatus(
    gatheringId: string,
    participantId: string,
    participantToken: string | undefined,
    contributionId: string,
    dto: UpdatePurchaseContributionStatusDto,
  ) {
    const participant = await this.requirePurchaseParticipant(
      gatheringId,
      participantId,
      participantToken,
    );
    const contribution = await this.prisma.purchaseContribution.findUnique({
      where: { id: contributionId },
      include: {
        purchaseItem: { include: { purchasePlan: true } },
      },
    });
    if (
      !contribution ||
      contribution.purchaseItem.purchasePlan.gatheringId !== gatheringId
    ) {
      throw new NotFoundException("Aporte no encontrado");
    }
    if (
      contribution.participantId !== participantId &&
      !participant.isOrganizer
    ) {
      throw new ForbiddenException("Sólo quien aportó puede marcarlo listo");
    }
    await this.prisma.purchaseContribution.update({
      where: { id: contributionId },
      data: { isReady: dto.isReady },
    });
    return {
      plan: await this.getPurchasePlan(gatheringId),
      activity: {
        action: dto.isReady ? ("ready" as const) : ("pending" as const),
        itemKey: contribution.purchaseItem.key,
        itemLabel: contribution.purchaseItem.label,
        participantId,
        participantName: participant.name,
      },
    };
  }

  async deletePurchaseContribution(
    gatheringId: string,
    participantId: string,
    participantToken: string | undefined,
    contributionId: string,
  ) {
    const participant = await this.requirePurchaseParticipant(
      gatheringId,
      participantId,
      participantToken,
    );
    const contribution = await this.prisma.purchaseContribution.findUnique({
      where: { id: contributionId },
      include: {
        purchaseItem: { include: { purchasePlan: true } },
      },
    });
    if (
      !contribution ||
      contribution.purchaseItem.purchasePlan.gatheringId !== gatheringId
    ) {
      throw new NotFoundException("Aporte no encontrado");
    }
    if (
      contribution.participantId !== participantId &&
      !participant.isOrganizer
    ) {
      throw new ForbiddenException("Sólo quien aportó puede quitarlo");
    }
    await this.prisma.purchaseContribution.delete({
      where: { id: contributionId },
    });
    return {
      plan: await this.getPurchasePlan(gatheringId),
      activity: {
        action: "remove" as const,
        itemKey: contribution.purchaseItem.key,
        itemLabel: contribution.purchaseItem.label,
        participantId,
        participantName: participant.name,
      },
    };
  }

  async addExpense(
    gatheringId: string,
    participantId: string,
    participantToken: string | undefined,
    dto: AddExpenseDto,
  ) {
    const participant = await this.prisma.participant.findFirst({
      where: { id: participantId, gatheringId },
      include: { gathering: { select: { status: true } } },
    });
    if (!participant) throw new NotFoundException("Participante no encontrado");
    if (!participantToken || participant.responseToken !== participantToken) {
      throw new UnauthorizedException(
        "No podés cargar gastos por otra persona",
      );
    }
    if (participant.gathering.status === GatheringStatus.CANCELLED) {
      throw new ConflictException("La juntada está cancelada");
    }

    return this.prisma.$transaction(async (transaction) => {
      await this.reopenExpenses(transaction, gatheringId);
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

  async updateExpense(
    gatheringId: string,
    participantId: string,
    participantToken: string | undefined,
    expenseId: string,
    dto: UpdateExpenseDto,
  ) {
    const participant = await this.requireParticipant(
      gatheringId,
      participantId,
      participantToken,
    );
    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, gatheringId },
    });
    if (!expense) throw new NotFoundException("Gasto no encontrado");
    if (
      expense.paidByParticipantId !== participant.id &&
      !participant.isOrganizer
    ) {
      throw new ForbiddenException(
        "Sólo quien pagó o quien organiza puede corregir este gasto",
      );
    }

    const updated = await this.prisma.$transaction(async (transaction) => {
      await this.reopenExpenses(transaction, gatheringId);
      return transaction.expense.update({
        where: { id: expenseId },
        data: {
          description: dto.description.trim(),
          amountCents: dto.amountCents,
        },
        include: {
          paidBy: { select: { id: true, name: true, avatarUrl: true } },
        },
      });
    });
    return { expense: updated, participantName: participant.name };
  }

  async deleteExpense(
    gatheringId: string,
    participantId: string,
    participantToken: string | undefined,
    expenseId: string,
  ) {
    const participant = await this.requireParticipant(
      gatheringId,
      participantId,
      participantToken,
    );
    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, gatheringId },
    });
    if (!expense) throw new NotFoundException("Gasto no encontrado");
    if (
      expense.paidByParticipantId !== participant.id &&
      !participant.isOrganizer
    ) {
      throw new ForbiddenException(
        "Sólo quien pagó o quien organiza puede eliminar este gasto",
      );
    }

    await this.prisma.$transaction(async (transaction) => {
      await this.reopenExpenses(transaction, gatheringId);
      await transaction.expense.delete({ where: { id: expenseId } });
    });
    return { id: expenseId, participantName: participant.name };
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
          participantNames.get(confirmation.fromParticipantId) ??
          "Participante",
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
    while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
      const debtor = debtors[debtorIndex];
      const creditor = creditors[creditorIndex];
      const amountCents = Math.min(debtor.amountCents, creditor.amountCents);
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

  async getPaymentDetails(
    gatheringId: string,
    participantId: string,
    participantToken: string | undefined,
  ) {
    const participant = await this.prisma.participant.findFirst({
      where: { id: participantId, gatheringId },
      select: {
        id: true,
        paymentAlias: true,
        responseToken: true,
      },
    });
    if (!participant) throw new NotFoundException("Participante no encontrado");
    if (!participantToken || participant.responseToken !== participantToken) {
      throw new UnauthorizedException("No podés ver datos de pago de otra persona");
    }

    const settlement = await this.getExpenseSettlement(gatheringId);
    if (!settlement.allReady) {
      return { paymentAlias: participant.paymentAlias, recipients: [] };
    }

    const recipientIds = [
      ...new Set(
        settlement.transfers
          .filter((transfer) => transfer.fromParticipantId === participantId)
          .map((transfer) => transfer.toParticipantId),
      ),
    ];
    const recipients = recipientIds.length
      ? await this.prisma.participant.findMany({
          where: { gatheringId, id: { in: recipientIds } },
          select: { id: true, name: true, paymentAlias: true },
        })
      : [];

    return {
      paymentAlias: participant.paymentAlias,
      recipients: recipients.map((recipient) => ({
        participantId: recipient.id,
        name: recipient.name,
        paymentAlias: recipient.paymentAlias,
      })),
    };
  }

  async updatePaymentAlias(
    gatheringId: string,
    participantId: string,
    participantToken: string | undefined,
    dto: UpdatePaymentAliasDto,
    identity: AuthIdentity | null,
  ) {
    const participant = await this.prisma.participant.findFirst({
      where: { id: participantId, gatheringId },
      select: {
        id: true,
        name: true,
        authUserId: true,
        responseToken: true,
      },
    });
    if (!participant) throw new NotFoundException("Participante no encontrado");
    if (!participantToken || participant.responseToken !== participantToken) {
      throw new UnauthorizedException("No podés editar el alias de otra persona");
    }

    const paymentAlias = this.normalizePaymentAlias(dto.paymentAlias);
    return this.prisma.$transaction(async (transaction) => {
      if (participant.authUserId && identity?.id === participant.authUserId) {
        await transaction.userPaymentProfile.upsert({
          where: { authUserId: participant.authUserId },
          create: { authUserId: participant.authUserId, paymentAlias },
          update: { paymentAlias },
        });
        await transaction.participant.updateMany({
          where: { authUserId: participant.authUserId },
          data: { paymentAlias },
        });
      } else {
        await transaction.participant.update({
          where: { id: participant.id },
          data: { paymentAlias },
        });
      }
      return { ...participant, paymentAlias };
    });
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

    // La confirmación se guarda contra la ronda de gastos vigente. Antes la
    // clave incluía el monto, así que un segundo pago por el mismo importe
    // entre las mismas dos personas pisaba al primero y la plata se perdía.
    return this.prisma.transferConfirmation.upsert({
      where: {
        roundPair: {
          gatheringId,
          expenseRound: settlement.expenseRound,
          fromParticipantId: participantId,
          toParticipantId: dto.toParticipantId,
        },
      },
      create: {
        gatheringId,
        expenseRound: settlement.expenseRound,
        fromParticipantId: participantId,
        toParticipantId: dto.toParticipantId,
        amountCents: dto.amountCents,
      },
      update: { amountCents: dto.amountCents, confirmedAt: new Date() },
      include: {
        fromParticipant: { select: { id: true, name: true } },
        toParticipant: { select: { id: true, name: true } },
      },
    });
  }

  private async reopenExpenses(
    transaction: Prisma.TransactionClient,
    gatheringId: string,
  ) {
    const state = await transaction.gathering.findUnique({
      where: { id: gatheringId },
      select: {
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
  }

  private async requireParticipant(
    gatheringId: string,
    participantId: string,
    participantToken: string | undefined,
  ) {
    const participant = await this.prisma.participant.findFirst({
      where: { id: participantId, gatheringId },
      include: { gathering: { select: { status: true } } },
    });
    if (!participant) throw new NotFoundException("Participante no encontrado");
    if (!participantToken || participant.responseToken !== participantToken) {
      throw new UnauthorizedException("No podés modificar datos de otra persona");
    }
    if (participant.gathering.status === GatheringStatus.CANCELLED) {
      throw new ConflictException("La juntada está cancelada");
    }
    return participant;
  }

  private async requireOrganizer(
    gatheringId: string,
    participantId: string,
    participantToken: string | undefined,
  ) {
    const participant = await this.prisma.participant.findFirst({
      where: { id: participantId, gatheringId },
      include: { gathering: true },
    });
    if (!participant) throw new NotFoundException("Participante no encontrado");
    if (!participantToken || participant.responseToken !== participantToken) {
      throw new UnauthorizedException("No podés administrar esta juntada");
    }
    if (!participant.isOrganizer) {
      throw new ForbiddenException("Sólo quien organiza puede hacer este cambio");
    }
    return participant;
  }

  private async ensureGathering(id: string) {
    const gathering = await this.prisma.gathering.findUnique({ where: { id } });
    if (!gathering) throw new NotFoundException("Juntada no encontrada");
    if (gathering.status === GatheringStatus.CANCELLED) {
      throw new ConflictException("La juntada está cancelada");
    }
  }

  private async ensureParticipantCapacity(gatheringId: string) {
    const count = await this.prisma.participant.count({
      where: { gatheringId },
    });
    if (count >= MAX_PARTICIPANTS) {
      throw new BadRequestException(
        `Esta juntada ya llegó al máximo de ${MAX_PARTICIPANTS} participantes`,
      );
    }
  }

  private async requirePurchaseParticipant(
    gatheringId: string,
    participantId: string,
    participantToken: string | undefined,
  ) {
    const participant = await this.prisma.participant.findFirst({
      where: { id: participantId, gatheringId },
      include: {
        gathering: {
          select: {
            status: true,
            _count: { select: { participants: true } },
          },
        },
      },
    });
    if (!participant) throw new NotFoundException("Participante no encontrado");
    if (!participantToken || participant.responseToken !== participantToken) {
      throw new UnauthorizedException("No podés editar aportes de otra persona");
    }
    if (participant.gathering.status === GatheringStatus.CANCELLED) {
      throw new ConflictException("La juntada está cancelada");
    }
    return participant;
  }

  private async applyPurchaseResponsibilityAction(
    transaction: Prisma.TransactionClient,
    itemId: string,
    assignedParticipantId: string | null,
    participant: { id: string; isOrganizer: boolean },
    action: PurchaseResponsibilityAction,
  ) {
    if (action === "claim") {
      if (assignedParticipantId === participant.id) return;
      const claimed = await transaction.purchaseItem.updateMany({
        where: { id: itemId, assignedParticipantId: null },
        data: {
          assignedParticipantId: participant.id,
          assignedAt: new Date(),
          isReady: false,
        },
      });
      if (claimed.count === 0) {
        const current = await transaction.purchaseItem.findUniqueOrThrow({
          where: { id: itemId },
          select: { assignedParticipantId: true },
        });
        if (current.assignedParticipantId !== participant.id) {
          throw new ConflictException(
            "Otra persona acaba de elegir este producto",
          );
        }
      }
      return;
    }

    if (!assignedParticipantId) {
      if (action === "release") return;
      throw new BadRequestException("Primero alguien debe hacerse cargo");
    }
    if (assignedParticipantId !== participant.id && !participant.isOrganizer) {
      throw new ForbiddenException(
        "Sólo quien lo eligió o quien organiza puede cambiarlo",
      );
    }

    if (action === "release") {
      await transaction.purchaseItem.updateMany({
        where: { id: itemId, assignedParticipantId },
        data: {
          assignedParticipantId: null,
          assignedAt: null,
          isReady: false,
        },
      });
      return;
    }

    await transaction.purchaseItem.updateMany({
      where: { id: itemId, assignedParticipantId },
      data: { isReady: action === "ready" },
    });
  }

  async addAuthenticatedParticipant(
    gatheringId: string,
    identity: AuthIdentity,
    dto: AuthParticipantDto,
  ) {
    await this.ensureGathering(gatheringId);
    const existing = await this.prisma.participant.findUnique({
      where: { gatheringId_authUserId: { gatheringId, authUserId: identity.id } },
      select: { id: true },
    });
    // Sólo se cuenta contra el tope si esto va a crear una fila nueva: quien
    // ya es parte de la juntada tiene que poder volver a entrar siempre.
    if (!existing) await this.ensureParticipantCapacity(gatheringId);
    const paymentProfile = await this.prisma.userPaymentProfile.findUnique({
      where: { authUserId: identity.id },
      select: { paymentAlias: true },
    });
    return this.prisma.participant.upsert({
      where: {
        gatheringId_authUserId: {
          gatheringId,
          authUserId: identity.id,
        },
      },
      create: {
        gatheringId,
        authUserId: identity.id,
        name: dto.name?.trim() || this.nameFromIdentity(identity),
        contact: identity.email,
        avatarUrl: dto.avatarUrl,
        paymentAlias: paymentProfile?.paymentAlias,
      },
      update: {},
    });
  }

  async linkAuthenticatedParticipant(
    gatheringId: string,
    participantId: string,
    participantToken: string | undefined,
    identity: AuthIdentity,
  ) {
    const participant = await this.prisma.participant.findFirst({
      where: { id: participantId, gatheringId },
    });
    if (!participant) throw new NotFoundException("Participante no encontrado");
    if (!participantToken || participant.responseToken !== participantToken) {
      throw new UnauthorizedException("No podés vincular otra participación");
    }

    const paymentProfile = await this.prisma.userPaymentProfile.findUnique({
      where: { authUserId: identity.id },
      select: { paymentAlias: true },
    });
    const existing = await this.prisma.participant.findUnique({
      where: {
        gatheringId_authUserId: {
          gatheringId,
          authUserId: identity.id,
        },
      },
    });
    if (existing) {
      if (existing.paymentAlias || !paymentProfile?.paymentAlias) return existing;
      return this.prisma.participant.update({
        where: { id: existing.id },
        data: { paymentAlias: paymentProfile.paymentAlias },
      });
    }

    return this.prisma.participant.update({
      where: { id: participant.id },
      data: {
        authUserId: identity.id,
        contact: participant.contact ?? identity.email,
        paymentAlias: participant.paymentAlias ?? paymentProfile?.paymentAlias,
      },
    });
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

  private nameFromIdentity(identity: AuthIdentity) {
    const emailName = identity.email?.split("@")[0]?.trim();
    return emailName || "Invitado";
  }

  private normalizePaymentAlias(value: string) {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (!/^[a-z0-9.-]{6,20}$/.test(normalized)) {
      throw new BadRequestException(
        "El alias debe tener entre 6 y 20 caracteres: letras, números, punto o guion",
      );
    }
    return normalized;
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
          assignedTo: stored?.assignee ?? null,
          assignedAt: stored?.assignedAt ?? null,
          isReady: stored?.isReady ?? false,
          contributions:
            stored?.contributions?.map((contribution) => ({
              id: contribution.id,
              catalogProductId: contribution.catalogProductId,
              catalogPresentationId: contribution.catalogPresentationId,
              description: contribution.description,
              quantity: contribution.quantity,
              unit: contribution.unit,
              note: contribution.note,
              isReady: contribution.isReady,
              createdAt: contribution.createdAt,
              updatedAt: contribution.updatedAt,
              participant: contribution.participant,
            })) ?? [],
        };
      }),
    };
  }
}
