import { Body, Controller, Get, Headers, Param, Post, Put } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AddExpenseDto } from "./dto/add-expense.dto";
import { AddParticipantDto } from "./dto/add-participant.dto";
import { ConfirmTransferDto } from "./dto/confirm-transfer.dto";
import { CreateGatheringDto } from "./dto/create-gathering.dto";
import { GoogleParticipantDto } from "./dto/google-participant.dto";
import { SetAvailabilityDto } from "./dto/set-availability.dto";
import { UpdatePurchasePlanDto } from "./dto/update-purchase-plan.dto";
import { GatheringsGateway } from "./gatherings.gateway";
import { GatheringsService } from "./gatherings.service";

@ApiTags("gatherings")
@Controller("gatherings")
export class GatheringsController {
  constructor(
    private readonly gatheringsService: GatheringsService,
    private readonly gatheringsGateway: GatheringsGateway,
  ) {}

  @Post()
  create(@Body() dto: CreateGatheringDto) {
    return this.gatheringsService.create(dto);
  }

  @Get(":slug")
  getBySlug(@Param("slug") slug: string) {
    return this.gatheringsService.getBySlug(slug);
  }

  @Post(":gatheringId/participants")
  addParticipant(
    @Param("gatheringId") gatheringId: string,
    @Body() dto: AddParticipantDto,
  ) {
    return this.gatheringsService.addParticipant(gatheringId, dto);
  }

  @Post(":gatheringId/participants/google")
  addGoogleParticipant(
    @Param("gatheringId") gatheringId: string,
    @Body() dto: GoogleParticipantDto,
  ) {
    return this.gatheringsService.addGoogleParticipant(gatheringId, dto);
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

  @Get(":gatheringId/matches")
  getMatches(@Param("gatheringId") gatheringId: string) {
    return this.gatheringsService.getMatches(gatheringId);
  }

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

  @Post(":gatheringId/participants/:participantId/expenses")
  async addExpense(
    @Param("gatheringId") gatheringId: string,
    @Param("participantId") participantId: string,
    @Headers("x-participant-token") participantToken: string | undefined,
    @Body() dto: AddExpenseDto,
  ) {
    const expense = await this.gatheringsService.addExpense(
      gatheringId,
      participantId,
      participantToken,
      dto,
    );
    this.gatheringsGateway.expensesChanged(gatheringId, expense.paidBy.name);
    return expense;
  }

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
}
