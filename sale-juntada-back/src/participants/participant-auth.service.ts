import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { GatheringStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { participantTokenMatches } from "./participant-token";

/**
 * Único lugar donde se decide si un `x-participant-token` autoriza una
 * acción.
 *
 * Antes la comprobación estaba copiada en más de veinte métodos de
 * `GatheringsService` y otra vez, distinta, en el gateway de Socket.IO. Un
 * endpoint nuevo que se olvidara de copiarla quedaba abierto sin que nada
 * lo señalara, y las dos implementaciones podían divergir. Concentrarlo acá
 * hace que agregar una regla se haga una sola vez y que HTTP y WebSocket
 * compartan exactamente el mismo criterio.
 */
@Injectable()
export class ParticipantAuthService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Exige que el token corresponda a ese participante de esa juntada.
   *
   * `message` permite conservar el texto que ya veía cada pantalla ("No
   * podés cargar gastos por otra persona") en vez de un error genérico.
   */
  async requireParticipant(
    gatheringId: string,
    participantId: string,
    token: string | undefined,
    message = "No podés modificar datos de otra persona",
  ) {
    const participant = await this.prisma.participant.findFirst({
      where: { id: participantId, gatheringId },
      include: {
        gathering: {
          select: {
            id: true,
            slug: true,
            status: true,
            _count: { select: { participants: true } },
          },
        },
      },
    });

    if (!participant) throw new NotFoundException("Participante no encontrado");
    if (!participantTokenMatches(token, participant.responseToken)) {
      throw new UnauthorizedException(message);
    }
    return participant;
  }

  /** Igual que `requireParticipant`, y además rechaza juntadas canceladas. */
  async requireActiveParticipant(
    gatheringId: string,
    participantId: string,
    token: string | undefined,
    message?: string,
  ) {
    const participant = await this.requireParticipant(
      gatheringId,
      participantId,
      token,
      message,
    );
    if (participant.gathering.status === GatheringStatus.CANCELLED) {
      throw new ConflictException("La juntada está cancelada");
    }
    return participant;
  }

  /**
   * Exige token válido y rol de organizador.
   *
   * Devuelve la juntada completa porque quienes la usan (finalizar,
   * editar, cancelar) necesitan la ventana horaria y la duración.
   */
  async requireOrganizer(
    gatheringId: string,
    participantId: string,
    token: string | undefined,
    messages: { unauthorized?: string; forbidden?: string } = {},
  ) {
    const {
      unauthorized = "No podés administrar esta juntada",
      forbidden = "Sólo quien organiza puede hacer este cambio",
    } = messages;
    const participant = await this.prisma.participant.findFirst({
      where: { id: participantId, gatheringId },
      include: {
        gathering: {
          include: { _count: { select: { participants: true } } },
        },
      },
    });

    if (!participant) throw new NotFoundException("Participante no encontrado");
    if (!participantTokenMatches(token, participant.responseToken)) {
      throw new UnauthorizedException(unauthorized);
    }
    // El rol se resuelve siempre contra la base. `isOrganizer` que llegue
    // del cliente no se mira nunca.
    if (!participant.isOrganizer) {
      throw new ForbiddenException(forbidden);
    }
    return participant;
  }

  /**
   * Resuelve el participante a partir del token, sin exigir que el llamador
   * ya sepa su id. Devuelve `null` en vez de lanzar: lo usan la vista
   * pública de la juntada y el socket, donde no tener credencial es un caso
   * esperado y no un error.
   */
  async findByToken(gatheringId: string, token: string | undefined) {
    if (!token) return null;

    const participant = await this.prisma.participant.findFirst({
      where: { gatheringId, responseToken: token },
      select: { id: true, name: true, isOrganizer: true, responseToken: true },
    });
    if (!participant) return null;
    // `findFirst` ya filtró por igualdad exacta; la comparación en tiempo
    // constante mantiene una sola definición de "token válido" en el
    // proyecto y evita que este camino se desincronice del resto.
    if (!participantTokenMatches(token, participant.responseToken)) return null;

    return { id: participant.id, name: participant.name, isOrganizer: participant.isOrganizer };
  }
}
