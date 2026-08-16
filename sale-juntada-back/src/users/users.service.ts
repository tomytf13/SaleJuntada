import { ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthIdentity } from "../auth/supabase-auth.service";
import { PrismaService } from "../prisma/prisma.service";

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
