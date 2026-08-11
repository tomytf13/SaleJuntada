import { Type } from "class-transformer";
import { IsInt, IsString, Max, Min } from "class-validator";

export class ConfirmTransferDto {
  @IsString()
  toParticipantId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amountCents!: number;
}
