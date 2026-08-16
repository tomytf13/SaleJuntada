import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class FinalizeGatheringDto {
  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  location?: string;
}
