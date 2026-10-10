import { IsBoolean } from "class-validator";

export class SetGatheringServiceDto {
  @IsBoolean()
  enabled!: boolean;
}
