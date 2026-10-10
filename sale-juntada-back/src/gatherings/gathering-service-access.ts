import { ConflictException, NotFoundException } from "@nestjs/common";
import { GatheringServiceKey, GatheringStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export async function lockGatheringServices(
  transaction: Prisma.TransactionClient,
  gatheringId: string,
) {
  // La configuración y las escrituras del servicio toman el mismo lock.
  // Una solicitud en vuelo termina antes del archivo o se rechaza después.
  const [gathering] = await transaction.$queryRaw<
    Array<{
      status: GatheringStatus;
      disabledServices: GatheringServiceKey[];
    }>
  >`SELECT "status", "disabledServices" FROM "Gathering" WHERE "id" = ${gatheringId} FOR UPDATE`;
  if (!gathering) throw new NotFoundException("Juntada no encontrada");
  if (gathering.status === GatheringStatus.CANCELLED) {
    throw new ConflictException("La juntada está cancelada");
  }
  return gathering;
}

export function withActiveGatheringService<T>(
  prisma: PrismaService,
  gatheringId: string,
  service: GatheringServiceKey,
  write: (transaction: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(async (transaction) => {
    const gathering = await lockGatheringServices(transaction, gatheringId);
    if (gathering.disabledServices.includes(service)) {
      throw new ConflictException(
        "Este servicio está desactivado. El historial se puede consultar, pero no modificar.",
      );
    }
    return write(transaction);
  });
}
