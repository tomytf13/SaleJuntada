import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ParticipantAuthService } from "./participant-auth.service";
import { ParticipantGuard } from "./participant.guard";

@Module({
  imports: [PrismaModule],
  providers: [ParticipantAuthService, ParticipantGuard],
  exports: [ParticipantAuthService, ParticipantGuard],
})
export class ParticipantsModule {}
