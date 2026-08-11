import { Module } from "@nestjs/common";
import { GatheringsController } from "./gatherings.controller";
import { GatheringsGateway } from "./gatherings.gateway";
import { GatheringsService } from "./gatherings.service";

@Module({
  controllers: [GatheringsController],
  providers: [GatheringsService, GatheringsGateway],
})
export class GatheringsModule {}
