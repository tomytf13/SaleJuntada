import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { generateParticipantToken } from "../participants/participant-token";
import type { AuthIdentity } from "../auth/supabase-auth.service";
import { PrismaService } from "../prisma/prisma.service";

// Archived settlements contain display-name snapshots indexed by participant ID.
function anonymizeSnapshot(
  value: Prisma.JsonValue,
  id: string,
): Prisma.JsonValue {
  if (Array.isArray(value))
    return value.map((entry) => anonymizeSnapshot(entry, id));
  if (!value || typeof value !== "object") return value;
  const output = Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      anonymizeSnapshot(entry!, id),
    ]),
  );
  if (value.participantId === id || value.id === id) {
    if ("name" in output) output.name = "Cuenta eliminada";
    if ("avatarUrl" in output) output.avatarUrl = null;
  }
  if (value.fromParticipantId === id) output.fromName = "Cuenta eliminada";
  if (value.toParticipantId === id) output.toName = "Cuenta eliminada";
  return output;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getGatheringHistory(identity: AuthIdentity) {
    const participations = await this.prisma.participant.findMany({
      where: { authUserId: identity.id },
      orderBy: { gathering: { updatedAt: "desc" } },
      select: {
        id: true,
        name: true,
        responseToken: true,
        isOrganizer: true,
        gathering: {
          select: {
            id: true,
            slug: true,
            title: true,
            status: true,
            organizerName: true,
            locationHint: true,
            finalizedLocation: true,
            finalizedStart: true,
            windowStart: true,
            windowEnd: true,
            createdAt: true,
            updatedAt: true,
            _count: { select: { participants: true } },
          },
        },
      },
    });

    return participations.map(({ gathering, ...participant }) => {
      const { _count, ...gatheringDetails } = gathering;
      return {
        ...gatheringDetails,
        participantCount: _count.participants,
        participant,
      };
    });
  }

  async deleteAccount(identity: AuthIdentity) {
    await this.prisma.$transaction(
      async (tx) => {
        // Auth and application tables are in the same Supabase database.
        // Roll back all changes if deleting the auth identity fails.
        const deleted =
          await tx.$executeRaw`DELETE FROM auth.users WHERE id = ${identity.id}::uuid`;
        if (!deleted)
          throw new ForbiddenException("La cuenta ya no está activa.");
        await tx.gathering.deleteMany({
          where: {
            participants: {
              some: { authUserId: identity.id, isOrganizer: true },
            },
          },
        });
        const members = await tx.participant.findMany({
          where: { authUserId: identity.id },
          orderBy: { gatheringId: "asc" },
          select: { id: true, gatheringId: true },
        });
        for (const member of members) {
          const [group] = await tx.$queryRaw<
            Array<{ archivedExpenseSettlement: Prisma.JsonValue }>
          >`SELECT "archivedExpenseSettlement" FROM "Gathering" WHERE id = ${member.gatheringId} FOR UPDATE`;
          if (group?.archivedExpenseSettlement) {
            await tx.gathering.update({
              where: { id: member.gatheringId },
              data: {
                archivedExpenseSettlement: anonymizeSnapshot(
                  group.archivedExpenseSettlement,
                  member.id,
                ) as Prisma.InputJsonValue,
              },
            });
          }
          await tx.gatheringFeedback.deleteMany({ where: { participantId: member.id } });
          await tx.gatheringReminder.deleteMany({
            where: { participantId: member.id },
          });
          await tx.availability.deleteMany({
            where: { participantId: member.id },
          });
          await tx.participant.update({
            where: { id: member.id },
            data: {
              authUserId: null,
              accountDeletedAt: new Date(),
              responseToken: generateParticipantToken(),
              name: "Cuenta eliminada",
              contact: null,
              avatarUrl: null,
              isBirthdayPerson: false,
              instagramUsername: null,
              paymentAlias: null,
              dietaryPreferences: [],
              mealArrangement: null,
              expensesReadyAt: new Date(),
            },
          });
        }
        await tx.userPaymentProfile.deleteMany({
          where: { authUserId: identity.id },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 30000,
      },
    );
    return { deleted: true };
  }

  async deleteGathering(gatheringId: string, identity: AuthIdentity) {
    const result = await this.prisma.gathering.deleteMany({
      where: {
        id: gatheringId,
        participants: {
          some: {
            authUserId: identity.id,
            isOrganizer: true,
          },
        },
      },
    });

    if (result.count === 0) {
      throw new ForbiddenException(
        "No podés eliminar una juntada que no organizaste.",
      );
    }

    return { id: gatheringId };
  }
}
