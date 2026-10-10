import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { SupabaseAuthService } from "../auth/supabase-auth.service";
import { PrismaService } from "../prisma/prisma.service";
import type { Request } from "express";

/** La credencial de participante nunca reemplaza la sesión de la cuenta. */
@Injectable()
export class GatheringAccountGuard implements CanActivate {
  constructor(
    private readonly auth: SupabaseAuthService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const action = context.getHandler().name;
    if (action === "getPurchaseCatalog") return true;
    const token = request.headers["x-participant-token"];
    const authorization = request.headers.authorization;
    if (action === "getBySlug" && (!authorization || !token)) {
      delete request.headers["x-participant-token"];
      return true;
    }
    if (!authorization)
      throw new UnauthorizedException("Ingresá a tu cuenta para participar");
    const identity = await this.auth.requireIdentity(authorization);
    if (typeof token === "string") {
      const participant = await this.prisma.participant.findUnique({
        where: { responseToken: token },
        select: { authUserId: true },
      });
      const owns = participant?.authUserId === identity.id;
      if (action === "getBySlug" && !owns) {
        delete request.headers["x-participant-token"];
        return true;
      }
      // Una credencial antigua sólo permite vincularse, no usar la app sin cuenta.
      if (
        !owns &&
        !(
          action === "linkAuthenticatedParticipant" &&
          participant &&
          !participant.authUserId
        )
      ) {
        throw new ForbiddenException("Este acceso no pertenece a tu cuenta");
      }
    }
    return true;
  }
}
