import { Module } from "@nestjs/common";
import { ParticipantsModule } from "../participants/participants.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RsvpService } from "./rsvp.service";

@Module({
  imports: [PrismaModule, ParticipantsModule],
  providers: [RsvpService],
  exports: [RsvpService],
})
export class RsvpModule {}
