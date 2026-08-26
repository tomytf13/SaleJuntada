import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma, RsvpStatus } from "@prisma/client";
import { ParticipantAuthService } from "../participants/participant-auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { SetRsvpDto } from "../gatherings/dto/set-rsvp.dto";

/** Recuento de asistencia. Sólo se expone a participantes. */
export type RsvpSummary = {
  going: number;
  maybe: number;
  notGoing: number;
  /** Participantes que todavía no respondieron (`rsvpStatus === null`). */
  pending: number;
  /** Gente que va a haber: la suma de `1 + plusOnes` entre los GOING. */
  goingHeadcount: number;
};

/** Forma mínima de participante que necesita el resumen. */
type RsvpCountable = {
  rsvpStatus: RsvpStatus | null;
  plusOnes: number;
};

/**
 * Respuestas a la invitación.
 *
 * La regla que ordena todo este servicio: **el RSVP sólo existe cuando la
 * juntada tiene fecha confirmada**. Mientras el grupo todavía la está
 * buscando, ser `Participant` ya significa "me interesa", y la pregunta
 * relevante es cuándo puede cada uno, no si viene.
 *
 * Sin esa regla el mismo valor cambiaría de significado con el tiempo:
 * alguien podría responder GOING sin fecha, marcar el jueves como no
 * disponible, y quedar como que confirmó el jueves cuando el organizador lo
 * elige. El dato mentiría.
 */
@Injectable()
export class RsvpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly participantAuth: ParticipantAuthService,
  ) {}

  async setRsvp(
    gatheringId: string,
    participantId: string,
    participantToken: string | undefined,
    dto: SetRsvpDto,
  ) {
    // Valida token, pertenencia y que la juntada no esté cancelada.
    await this.participantAuth.requireActiveParticipant(
      gatheringId,
      participantId,
      participantToken,
      "No podés responder por otra persona",
    );

    const gathering = await this.prisma.gathering.findUniqueOrThrow({
      where: { id: gatheringId },
      select: { finalizedStart: true },
    });
    if (gathering.finalizedStart === null) {
      throw new ConflictException(
        "La juntada todavía no tiene una fecha confirmada. Por ahora marcá cuándo podés.",
      );
    }

    // Quien no va no lleva acompañantes. Es regla del servidor: el cliente
    // podría mandar cualquier cosa.
    const plusOnes = dto.status === RsvpStatus.GOING ? (dto.plusOnes ?? 0) : 0;

    const participant = await this.prisma.participant.update({
      where: { id: participantId },
      data: {
        rsvpStatus: dto.status,
        plusOnes,
        rsvpAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        rsvpStatus: true,
        plusOnes: true,
        rsvpAt: true,
      },
    });

    return {
      participantId: participant.id,
      participantName: participant.name,
      rsvpStatus: participant.rsvpStatus,
      plusOnes: participant.plusOnes,
      rsvpAt: participant.rsvpAt,
      rsvpSummary: await this.getSummary(gatheringId),
    };
  }

  /**
   * Deja el RSVP como corresponde a una juntada que acaba de quedar con
   * fecha, o cuya fecha cambió.
   *
   * Una confirmación de asistencia pertenece a **una fecha concreta**: si la
   * fecha cambia, lo que cada uno respondió antes ya no significa lo mismo.
   * Por eso el resto vuelve a "sin responder" en vez de arrastrar su
   * respuesta a un día que nunca aceptaron.
   *
   * Los acompañantes también dependen de la fecha —quien iba a venir con
   * dos personas el sábado no necesariamente puede el martes— así que el
   * `plusOnes` de quien organiza también vuelve a 0.
   *
   * Recibe el cliente transaccional para poder correr en la misma
   * transacción que el cambio de fecha: el estado de la fecha y el del RSVP
   * tienen que moverse juntos.
   */
  async resetForConfirmedDate(
    transaction: Prisma.TransactionClient,
    gatheringId: string,
  ) {
    await transaction.participant.updateMany({
      where: { gatheringId, isOrganizer: false },
      data: { rsvpStatus: null, plusOnes: 0, rsvpAt: null },
    });
    await transaction.participant.updateMany({
      where: { gatheringId, isOrganizer: true },
      data: { rsvpStatus: RsvpStatus.GOING, plusOnes: 0, rsvpAt: new Date() },
    });
  }

  /**
   * Deja el RSVP como corresponde a una juntada que volvió a no tener fecha.
   *
   * Acá se resetea a **todos**, incluido quien organiza: sin fecha el RSVP
   * no aplica para nadie y la pregunta vuelve a ser cuándo puede cada uno.
   */
  async resetForOpenScheduling(
    transaction: Prisma.TransactionClient,
    gatheringId: string,
  ) {
    await transaction.participant.updateMany({
      where: { gatheringId },
      data: { rsvpStatus: null, plusOnes: 0, rsvpAt: null },
    });
  }

  /** Resumen leído de la base. Para cuando no se tienen los participantes a mano. */
  async getSummary(gatheringId: string): Promise<RsvpSummary> {
    const participants = await this.prisma.participant.findMany({
      where: { gatheringId },
      select: { rsvpStatus: true, plusOnes: true },
    });
    return summarizeRsvp(participants);
  }
}

/**
 * Arma el resumen a partir de participantes ya cargados.
 *
 * Está fuera de la clase para que `getBySlug` —que ya trae la lista
 * completa— no tenga que volver a consultar la base sólo para contar.
 */
export function summarizeRsvp(participants: RsvpCountable[]): RsvpSummary {
  const summary: RsvpSummary = {
    going: 0,
    maybe: 0,
    notGoing: 0,
    pending: 0,
    goingHeadcount: 0,
  };

  for (const participant of participants) {
    switch (participant.rsvpStatus) {
      case RsvpStatus.GOING:
        summary.going += 1;
        // La persona más sus acompañantes.
        summary.goingHeadcount += 1 + participant.plusOnes;
        break;
      case RsvpStatus.MAYBE:
        summary.maybe += 1;
        break;
      case RsvpStatus.NOT_GOING:
        summary.notGoing += 1;
        break;
      default:
        summary.pending += 1;
    }
  }

  return summary;
}

/** `select` de Prisma con lo que el resumen necesita. */
export const rsvpCountableSelect = {
  rsvpStatus: true,
  plusOnes: true,
} satisfies Prisma.ParticipantSelect;
