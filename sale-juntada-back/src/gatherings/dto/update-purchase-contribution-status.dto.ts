import { IsBoolean } from "class-validator";

export class UpdatePurchaseContributionStatusDto {
  @IsBoolean()
  isReady!: boolean;
}
