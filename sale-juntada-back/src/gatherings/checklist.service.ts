import { withActiveGatheringService } from "./gathering-service-access";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ParticipantAuthService } from "../participants/participant-auth.service";
import {
  CreateChecklistItemDto,
  UpdateChecklistItemDto,
} from "./dto/checklist.dto";

const assigneeSelect = { id: true, name: true, avatarUrl: true } as const;

@Injectable()
export class ChecklistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: ParticipantAuthService,
  ) {}

  list(gatheringId: string) {
    return this.prisma.checklistItem.findMany({
      where: { gatheringId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: { assignee: { select: assigneeSelect } },
    });
  }

  async create(
    gatheringId: string,
    participantId: string,
    token: string | undefined,
    dto: CreateChecklistItemDto,
  ) {
    await this.auth.requireActiveParticipant(gatheringId, participantId, token);
    return withActiveGatheringService(
      this.prisma,
      gatheringId,
      "pendientes",
      (transaction) =>
        transaction.checklistItem.create({
          data: { gatheringId, label: dto.label.trim() },
          include: { assignee: { select: assigneeSelect } },
        }),
    );
  }

  async update(
    gatheringId: string,
    participantId: string,
    token: string | undefined,
    itemId: string,
    dto: UpdateChecklistItemDto,
  ) {
    const actor = await this.auth.requireActiveParticipant(
      gatheringId,
      participantId,
      token,
    );
    return withActiveGatheringService(
      this.prisma,
      gatheringId,
      "pendientes",
      async (transaction) => {
        const item = await transaction.checklistItem.findFirst({
          where: { id: itemId, gatheringId },
        });
        if (!item)
          throw new NotFoundException(
            "No encontramos esa necesidad en la juntada",
          );
        let assignedParticipantId = item.assignedParticipantId;
        let isReady = item.isReady;
        if (dto.action === "claim") {
          if (
            assignedParticipantId &&
            assignedParticipantId !== participantId
          ) {
            throw new ConflictException(
              "Alguien ya se está encargando. Pedile al organizador que cambie el responsable.",
            );
          }
          assignedParticipantId = participantId;
        } else if (dto.action === "assign") {
          if (!actor.isOrganizer)
            throw new ForbiddenException(
              "Sólo quien organiza puede asignar responsables",
            );
          const target = await transaction.participant.findFirst({
            where: { id: dto.assignedParticipantId, gatheringId },
          });
          if (!target || !dto.assignedParticipantId)
            throw new BadRequestException(
              "El responsable debe ser parte de esta juntada",
            );
          assignedParticipantId = target.id;
        } else {
          if (assignedParticipantId !== participantId && !actor.isOrganizer) {
            throw new ForbiddenException(
              "Sólo el responsable o quien organiza puede cambiar este estado",
            );
          }
          if (dto.action === "release") assignedParticipantId = null;
          else {
            if (!assignedParticipantId)
              throw new ConflictException("Primero hace falta un responsable");
            isReady = dto.action === "ready";
          }
        }
        if (
          assignedParticipantId !== item.assignedParticipantId ||
          !assignedParticipantId
        )
          isReady = false;
        // Comparar el responsable leído hace que dos personas no puedan
        // apropiarse de la misma tarea con requests simultáneos.
        const result = await transaction.checklistItem.updateMany({
          where: {
            id: itemId,
            gatheringId,
            assignedParticipantId: item.assignedParticipantId,
            isReady: item.isReady,
          },
          data: { assignedParticipantId, isReady },
        });
        if (result.count !== 1)
          throw new ConflictException(
            "Esta necesidad cambió. Revisá el responsable e intentá de nuevo.",
          );
        return transaction.checklistItem.findUniqueOrThrow({
          where: { id: itemId },
          include: { assignee: { select: assigneeSelect } },
        });
      },
    );
  }

  async remove(
    gatheringId: string,
    participantId: string,
    token: string | undefined,
    itemId: string,
  ) {
    const actor = await this.auth.requireActiveParticipant(
      gatheringId,
      participantId,
      token,
    );
    if (!actor.isOrganizer)
      throw new ForbiddenException(
        "Sólo quien organiza puede quitar una necesidad",
      );
    const result = await withActiveGatheringService(
      this.prisma,
      gatheringId,
      "pendientes",
      (transaction) =>
        transaction.checklistItem.deleteMany({
          where: { id: itemId, gatheringId },
        }),
    );
    if (!result.count)
      throw new NotFoundException("No encontramos esa necesidad en la juntada");
    return { deleted: true };
  }
}
