import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from "@nestjs/common";
import { IsString, Matches, MaxLength } from "class-validator";
import { ParticipantAuthService } from "../../participants/participant-auth.service";
import { GatheringAccountGuard } from "../gathering-account.guard";
import { RemindersService } from "./reminders.service";

class SubscriptionDto {
  @IsString() @MaxLength(2048) endpoint!: string;
  @Matches(/^[A-Za-z0-9_-]{87}$/) p256dh!: string;
  @Matches(/^[A-Za-z0-9_-]{22}$/) auth!: string;
}

function isPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      (url.hostname === "fcm.googleapis.com" ||
        url.hostname === "web.push.apple.com" ||
        url.hostname === "updates.push.services.mozilla.com" ||
        url.hostname.endsWith(".push.services.mozilla.com") ||
        url.hostname.endsWith(".notify.windows.com") ||
        url.hostname.endsWith(".push.apple.com"))
    );
  } catch {
    return false;
  }
}

@Controller("gatherings/:gatheringId/participants/:participantId/reminders")
@UseGuards(GatheringAccountGuard)
export class RemindersController {
  constructor(
    private readonly participants: ParticipantAuthService,
    private readonly reminders: RemindersService,
  ) {}

  @Get(":deviceId")
  async settings(
    @Param("gatheringId") gathering: string,
    @Param("participantId") participant: string,
    @Param("deviceId", ParseUUIDPipe) device: string,
    @Headers("x-participant-token") token?: string,
  ) {
    await this.participants.requireParticipant(gathering, participant, token);
    return this.reminders.settings(participant, device);
  }

  @Put(":deviceId")
  async enable(
    @Param("gatheringId") gathering: string,
    @Param("participantId") participant: string,
    @Param("deviceId", ParseUUIDPipe) device: string,
    @Body() body: SubscriptionDto,
    @Headers("x-participant-token") token?: string,
  ) {
    await this.participants.requireActiveParticipant(
      gathering,
      participant,
      token,
    );
    if (!isPushEndpoint(body.endpoint))
      throw new BadRequestException(
        "El servicio push del navegador no es compatible",
      );
    await this.reminders.enable(participant, device, body);
    return { enabled: true };
  }

  @Delete(":deviceId")
  async disable(
    @Param("gatheringId") gathering: string,
    @Param("participantId") participant: string,
    @Param("deviceId", ParseUUIDPipe) device: string,
    @Headers("x-participant-token") token?: string,
  ) {
    await this.participants.requireParticipant(gathering, participant, token);
    await this.reminders.disable(participant, device);
    return { enabled: false };
  }
}
