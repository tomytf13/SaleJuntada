import { RemindersService } from "./reminders/reminders.service";
import { RemindersController } from "./reminders/reminders.controller";
import { GatheringAccountGuard } from "./gathering-account.guard";
import { ChecklistService } from "./checklist.service";
import { Module } from "@nestjs/common";
import { ParticipantsModule } from "../participants/participants.module";
import { RsvpModule } from "../rsvp/rsvp.module";
import { GatheringsController } from "./gatherings.controller";
import { GatheringsGateway } from "./gatherings.gateway";
import { GatheringsService } from "./gatherings.service";

@Module({
  imports: [ParticipantsModule, RsvpModule],
  controllers: [GatheringsController, RemindersController],
  providers: [RemindersService, GatheringAccountGuard, GatheringsService, GatheringsGateway, ChecklistService],
})
export class GatheringsModule {}
