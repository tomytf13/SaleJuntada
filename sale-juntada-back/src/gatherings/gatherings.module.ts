import { Module } from "@nestjs/common";
import { ParticipantsModule } from "../participants/participants.module";
import { RsvpModule } from "../rsvp/rsvp.module";
import { GatheringsController } from "./gatherings.controller";
import { GatheringsGateway } from "./gatherings.gateway";
import { GatheringsService } from "./gatherings.service";

@Module({
  imports: [ParticipantsModule, RsvpModule],
  controllers: [GatheringsController],
  providers: [GatheringsService, GatheringsGateway],
})
export class GatheringsModule {}
