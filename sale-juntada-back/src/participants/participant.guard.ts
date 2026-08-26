import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { ParticipantAuthService } from "./participant-auth.service";

export type RequestParticipant = {
  id: string;
  name: string;
  isOrganizer: boolean;
};

/** Request con el participante ya resuelto por `ParticipantGuard`. */
type AuthenticatedRequest = Request & { participant?: RequestParticipant };

function onlyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Exige un `x-participant-token` válido para la juntada de la ruta.
 *
 * Se usa en los endpoints de sólo lectura que exponen datos del grupo
 * (coincidencias, compra, liquidación). Antes eran públicos: bastaba con
 * conocer el id de la juntada para leer quién le debe cuánto a quién, con
 * nombres y montos.
 *
 * No hace falta `participantId` en la ruta porque el token ya es único por
 * participante; alcanza para identificarlo dentro de la juntada.
 */
@Injectable()
export class ParticipantGuard implements CanActivate {
  constructor(private readonly participantAuth: ParticipantAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    // Express tipa params y cabeceras como `string | string[]`: un valor
    // repetido llega como arreglo y no es una entrada válida en ninguno de
    // los dos casos.
    const gatheringId = onlyString(request.params?.gatheringId);
    if (!gatheringId) {
      throw new BadRequestException("Falta el identificador de la juntada");
    }

    const participant = await this.participantAuth.findByToken(
      gatheringId,
      onlyString(request.headers["x-participant-token"]),
    );
    if (!participant) {
      throw new UnauthorizedException(
        "Sumate a la juntada para ver esta información",
      );
    }

    request.participant = participant;
    return true;
  }
}
