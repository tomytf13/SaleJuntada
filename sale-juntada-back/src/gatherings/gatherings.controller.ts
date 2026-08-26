import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ApiHeader, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { SupabaseAuthService } from "../auth/supabase-auth.service";
import { ParticipantGuard } from "../participants/participant.guard";
import { AddExpenseDto } from "./dto/add-expense.dto";
import { AddParticipantDto } from "./dto/add-participant.dto";
import { AuthParticipantDto } from "./dto/auth-participant.dto";
import { ConfirmTransferDto } from "./dto/confirm-transfer.dto";
import { CreateGatheringDto } from "./dto/create-gathering.dto";
import { FinalizeGatheringDto } from "./dto/finalize-gathering.dto";
import { SetAvailabilityDto } from "./dto/set-availability.dto";
import { SetRsvpDto } from "./dto/set-rsvp.dto";
import { UpdateDietaryProfileDto } from "./dto/update-dietary-profile.dto";
import { UpdateExpenseDto } from "./dto/update-expense.dto";
import { UpdateGatheringDto } from "./dto/update-gathering.dto";
import { UpdatePaymentAliasDto } from "./dto/update-payment-alias.dto";
import { UpdatePurchasePlanDto } from "./dto/update-purchase-plan.dto";
import { UpdatePurchaseContributionStatusDto } from "./dto/update-purchase-contribution-status.dto";
import { UpdatePurchaseResponsibilityDto } from "./dto/update-purchase-responsibility.dto";
import { UpsertPurchaseContributionDto } from "./dto/upsert-purchase-contribution.dto";
import { GatheringsGateway } from "./gatherings.gateway";
import { GatheringsService } from "./gatherings.service";
import { RsvpService } from "../rsvp/rsvp.service";

@ApiTags("gatherings")
@Controller("gatherings")
export class GatheringsController {
  constructor(
    private readonly gatheringsService: GatheringsService,
    private readonly gatheringsGateway: GatheringsGateway,
    private readonly authService: SupabaseAuthService,
    private readonly rsvpService: RsvpService,
  ) {}

  // Crear una juntada escribe varias filas y genera un slug: es la operación
  // más cara del endpoint público. 10 por minuto alcanza de sobra para uso
  // legítimo y corta la creación masiva automatizada.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  async create(
    @Headers("authorization") authorization: string | undefined,
    @Body() dto: CreateGatheringDto,
  ) {
    const identity = await this.authService.optionalIdentity(authorization);
    return this.gatheringsService.create(dto, identity);
  }

  /**
   * Vista de la juntada. Sin `x-participant-token` devuelve sólo lo
   * necesario para decidir sumarse; con un token válido, la juntada
   * completa. Ver `GatheringsService.getBySlug`.
   */
  @ApiHeader({
    name: "x-participant-token",
    required: false,
    description: "Con un token válido la respuesta incluye los datos privados",
  })
  @Get(":slug")
  getBySlug(
    @Param("slug") slug: string,
    @Headers("x-participant-token") participantToken: string | undefined,
  ) {
    return this.gatheringsService.getBySlug(slug, participantToken);
  }

  // Catálogo de productos: es contenido estático de la app, sin datos de
  // ninguna persona. Se mantiene público a propósito.
  @Get("catalog/purchase")
  @Header("Cache-Control", "public, max-age=300, stale-while-revalidate=3600")
  getPurchaseCatalog() {
    return this.gatheringsService.getPurchaseCatalog();
  }

  // Sumarse no exige credencial por diseño (ese es el punto del link), así
  // que es el endpoint más expuesto a inflar un grupo con gente falsa. El
  // tope de participantes ya lo limita; esto además frena el ritmo.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(":gatheringId/participants")
  addParticipant(
    @Param("gatheringId") gatheringId: string,
    @Body() dto: AddParticipantDto,
  ) {
    return this.gatheringsService.addParticipant(gatheringId, dto);
  }

  @Post(":gatheringId/participants/auth")
  async addAuthenticatedParticipant(
    @Param("gatheringId") gatheringId: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() dto: AuthParticipantDto,
  ) {
    const identity = await this.authService.requireIdentity(authorization);
    return this.gatheringsService.addAuthenticatedParticipant(
      gatheringId,
      identity,
      dto,
    );
  }

  @Post(":gatheringId/participants/:participantId/auth-link")
  async linkAuthenticatedParticipant(
    @Param("gatheringId") gatheringId: string,
    @Param("participantId") participantId: string,
    @Headers("authorization") authorization: string | undefined,
    @Headers("x-participant-token") participantToken: string | undefined,
  ) {
    const identity = await this.authService.requireIdentity(authorization);
    return this.gatheringsService.linkAuthenticatedParticipant(
      gatheringId,
      participantId,
      participantToken,
      identity,
    );
  }

  @Put(":gatheringId/participants/:participantId/availability")
  setAvailability(
    @Param("gatheringId") gatheringId: string,
    @Param("participantId") participantId: string,
    @Headers("x-participant-token") participantToken: string | undefined,
    @Body() dto: SetAvailabilityDto,
  ) {
    return this.gatheringsService.setAvailability(
      gatheringId,
      participantId,
      participantToken,
      dto,
    );
  }

  /**
   * Responde la invitación.
   *
   * Sólo aplica cuando la juntada tiene fecha confirmada: mientras el grupo
   * la está buscando, la pregunta es "¿cuándo podés?" y no "¿venís?".
   */
  @Put(":gatheringId/participants/:participantId/rsvp")
  async setRsvp(
    @Param("gatheringId") gatheringId: string,
    @Param("participantId") participantId: string,
    @Headers("x-participant-token") participantToken: string | undefined,
    @Body() dto: SetRsvpDto,
  ) {
    const result = await this.rsvpService.setRsvp(
      gatheringId,
      participantId,
      participantToken,
      dto,
    );
    this.gatheringsGateway.rsvpChanged(gatheringId, {
      participantId: result.participantId,
      participantName: result.participantName,
      rsvpStatus: result.rsvpStatus,
      plusOnes: result.plusOnes,
    });
    return result;
  }

  @UseGuards(ParticipantGuard)
  @Get(":gatheringId/matches")
  getMatches(@Param("gatheringId") gatheringId: string) {
    return this.gatheringsService.getMatches(gatheringId);
  }

  @Put(":gatheringId/participants/:participantId/finalization")
  async finalizeGathering(
    @Param("gatheringId") gatheringId: string,
    @Param("participantId") participantId: string,
    @Headers("x-participant-token") participantToken: string | undefined,
    @Body() dto: FinalizeGatheringDto,
  ) {
    const gathering = await this.gatheringsService.finalizeGathering(
      gatheringId,
      participantId,
      participantToken,
      dto,
    );
    this.gatheringsGateway.gatheringChanged(gatheringId, "confirmed");
    return gathering;
  }

  @Patch(":gatheringId/participants/:participantId/settings")
  async updateGathering(
    @Param("gatheringId") gatheringId: string,
    @Param("participantId") participantId: string,
    @Headers("x-participant-token") participantToken: string | undefined,
    @Body() dto: UpdateGatheringDto,
  ) {
    const gathering = await this.gatheringsService.updateGathering(
      gatheringId,
      participantId,
      participantToken,
      dto,
    );
    this.gatheringsGateway.gatheringChanged(gatheringId, "updated");
    return gathering;
  }

  @Delete(":gatheringId/participants/:participantId/settings")
  async cancelGathering(
    @Param("gatheringId") gatheringId: string,
    @Param("participantId") participantId: string,
    @Headers("x-participant-token") participantToken: string | undefined,
  ) {
    const gathering = await this.gatheringsService.cancelGathering(
      gatheringId,
      participantId,
      participantToken,
    );
    this.gatheringsGateway.gatheringChanged(gatheringId, "cancelled");
    return gathering;
  }

  @Put(":gatheringId/participants/:participantId/dietary-profile")
  async updateDietaryProfile(
    @Param("gatheringId") gatheringId: string,
    @Param("participantId") participantId: string,
    @Headers("x-participant-token") participantToken: string | undefined,
    @Body() dto: UpdateDietaryProfileDto,
  ) {
    const participant = await this.gatheringsService.updateDietaryProfile(
      gatheringId,
      participantId,
      participantToken,
      dto,
    );
    this.gatheringsGateway.dietaryChanged(gatheringId, participant.name);
    return participant;
  }

  @Get(":gatheringId/participants/:participantId/payment-details")
  getPaymentDetails(
    @Param("gatheringId") gatheringId: string,
    @Param("participantId") participantId: string,
    @Headers("x-participant-token") participantToken: string | undefined,
  ) {
    return this.gatheringsService.getPaymentDetails(
      gatheringId,
      participantId,
      participantToken,
    );
  }

  @Put(":gatheringId/participants/:participantId/payment-alias")
  async updatePaymentAlias(
    @Param("gatheringId") gatheringId: string,
    @Param("participantId") participantId: string,
    @Headers("authorization") authorization: string | undefined,
    @Headers("x-participant-token") participantToken: string | undefined,
    @Body() dto: UpdatePaymentAliasDto,
  ) {
    const identity = await this.authService.optionalIdentity(authorization);
    const result = await this.gatheringsService.updatePaymentAlias(
      gatheringId,
      participantId,
      participantToken,
      dto,
      identity,
    );
    this.gatheringsGateway.transfersChanged(gatheringId, result.name);
    return { paymentAlias: result.paymentAlias };
  }

  @UseGuards(ParticipantGuard)
  @Get(":gatheringId/purchase")
  getPurchasePlan(@Param("gatheringId") gatheringId: string) {
    return this.gatheringsService.getPurchasePlan(gatheringId);
  }

  @Put(":gatheringId/participants/:participantId/purchase")
  async updatePurchasePlan(
    @Param("gatheringId") gatheringId: string,
    @Param("participantId") participantId: string,
    @Headers("x-participant-token") participantToken: string | undefined,
    @Body() dto: UpdatePurchasePlanDto,
  ) {
    const plan = await this.gatheringsService.updatePurchasePlan(
      gatheringId,
      participantId,
      participantToken,
      dto,
    );
    this.gatheringsGateway.purchaseChanged(gatheringId);
    return plan;
  }

  @Put(
    ":gatheringId/participants/:participantId/purchase/items/:itemKey/responsibility",
  )
  async updatePurchaseResponsibility(
    @Param("gatheringId") gatheringId: string,
    @Param("participantId") participantId: string,
    @Param("itemKey") itemKey: string,
    @Headers("x-participant-token") participantToken: string | undefined,
    @Body() dto: UpdatePurchaseResponsibilityDto,
  ) {
    const { plan, activity } =
      await this.gatheringsService.updatePurchaseResponsibility(
        gatheringId,
        participantId,
        participantToken,
        itemKey,
        dto,
      );
    this.gatheringsGateway.purchaseChanged(gatheringId, activity);
    return plan;
  }

  @Put(
    ":gatheringId/participants/:participantId/purchase/items/:itemKey/contribution",
  )
  async upsertPurchaseContribution(
    @Param("gatheringId") gatheringId: string,
    @Param("participantId") participantId: string,
    @Param("itemKey") itemKey: string,
    @Headers("x-participant-token") participantToken: string | undefined,
    @Body() dto: UpsertPurchaseContributionDto,
  ) {
    const { plan, activity } =
      await this.gatheringsService.upsertPurchaseContribution(
        gatheringId,
        participantId,
        participantToken,
        itemKey,
        dto,
      );
    this.gatheringsGateway.purchaseChanged(gatheringId, activity);
    return plan;
  }

  @Patch(
    ":gatheringId/participants/:participantId/purchase/contributions/:contributionId/status",
  )
  async updatePurchaseContributionStatus(
    @Param("gatheringId") gatheringId: string,
    @Param("participantId") participantId: string,
    @Param("contributionId") contributionId: string,
    @Headers("x-participant-token") participantToken: string | undefined,
    @Body() dto: UpdatePurchaseContributionStatusDto,
  ) {
    const { plan, activity } =
      await this.gatheringsService.updatePurchaseContributionStatus(
        gatheringId,
        participantId,
        participantToken,
        contributionId,
        dto,
      );
    this.gatheringsGateway.purchaseChanged(gatheringId, activity);
    return plan;
  }

  @Delete(
    ":gatheringId/participants/:participantId/purchase/contributions/:contributionId",
  )
  async deletePurchaseContribution(
    @Param("gatheringId") gatheringId: string,
    @Param("participantId") participantId: string,
    @Param("contributionId") contributionId: string,
    @Headers("x-participant-token") participantToken: string | undefined,
  ) {
    const { plan, activity } =
      await this.gatheringsService.deletePurchaseContribution(
        gatheringId,
        participantId,
        participantToken,
        contributionId,
      );
    this.gatheringsGateway.purchaseChanged(gatheringId, activity);
    return plan;
  }

  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    description:
      "UUID por intento lógico. Reintentar con la misma clave devuelve el gasto ya creado en vez de duplicarlo.",
  })
  @Post(":gatheringId/participants/:participantId/expenses")
  async addExpense(
    @Param("gatheringId") gatheringId: string,
    @Param("participantId") participantId: string,
    @Headers("x-participant-token") participantToken: string | undefined,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() dto: AddExpenseDto,
  ) {
    const expense = await this.gatheringsService.addExpense(
      gatheringId,
      participantId,
      participantToken,
      this.requireIdempotencyKey(idempotencyKey),
      dto,
    );
    this.gatheringsGateway.expensesChanged(gatheringId, expense.paidBy.name);
    return expense;
  }

  @Patch(":gatheringId/participants/:participantId/expenses/:expenseId")
  async updateExpense(
    @Param("gatheringId") gatheringId: string,
    @Param("participantId") participantId: string,
    @Param("expenseId") expenseId: string,
    @Headers("x-participant-token") participantToken: string | undefined,
    @Body() dto: UpdateExpenseDto,
  ) {
    const result = await this.gatheringsService.updateExpense(
      gatheringId,
      participantId,
      participantToken,
      expenseId,
      dto,
    );
    this.gatheringsGateway.expensesChanged(
      gatheringId,
      result.participantName,
    );
    return result.expense;
  }

  @Delete(":gatheringId/participants/:participantId/expenses/:expenseId")
  async deleteExpense(
    @Param("gatheringId") gatheringId: string,
    @Param("participantId") participantId: string,
    @Param("expenseId") expenseId: string,
    @Headers("x-participant-token") participantToken: string | undefined,
  ) {
    const result = await this.gatheringsService.deleteExpense(
      gatheringId,
      participantId,
      participantToken,
      expenseId,
    );
    this.gatheringsGateway.expensesChanged(
      gatheringId,
      result.participantName,
    );
    return { id: result.id };
  }

  @UseGuards(ParticipantGuard)
  @Get(":gatheringId/expenses/settlement")
  getExpenseSettlement(@Param("gatheringId") gatheringId: string) {
    return this.gatheringsService.getExpenseSettlement(gatheringId);
  }

  @Post(":gatheringId/participants/:participantId/expenses/ready")
  async markExpensesReady(
    @Param("gatheringId") gatheringId: string,
    @Param("participantId") participantId: string,
    @Headers("x-participant-token") participantToken: string | undefined,
  ) {
    const participant = await this.gatheringsService.markExpensesReady(
      gatheringId,
      participantId,
      participantToken,
    );
    this.gatheringsGateway.expensesChanged(gatheringId, participant.name);
    return participant;
  }

  @Post(":gatheringId/participants/:participantId/transfers/confirm")
  async confirmTransfer(
    @Param("gatheringId") gatheringId: string,
    @Param("participantId") participantId: string,
    @Headers("x-participant-token") participantToken: string | undefined,
    @Body() dto: ConfirmTransferDto,
  ) {
    const confirmation = await this.gatheringsService.confirmTransfer(
      gatheringId,
      participantId,
      participantToken,
      dto,
    );
    this.gatheringsGateway.transfersChanged(
      gatheringId,
      confirmation.fromParticipant.name,
    );
    return confirmation;
  }

  /**
   * La clave de idempotencia es obligatoria: si fuera opcional, un cliente
   * que se olvide de mandarla perdería la protección sin que nadie se
   * entere. Es preferible un 400 ruidoso a un gasto duplicado en silencio.
   */
  private requireIdempotencyKey(value: string | undefined) {
    const key = value?.trim();
    if (!key) {
      throw new BadRequestException(
        "Falta la cabecera Idempotency-Key para cargar el gasto",
      );
    }
    if (key.length > 200) {
      throw new BadRequestException("La cabecera Idempotency-Key es demasiado larga");
    }
    return key;
  }
}
