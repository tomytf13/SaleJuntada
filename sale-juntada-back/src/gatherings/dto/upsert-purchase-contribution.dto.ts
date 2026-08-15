import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class UpsertPurchaseContributionDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  catalogProductId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(96)
  catalogPresentationId?: string;

  @IsInt()
  @Min(1)
  @Max(999)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  note?: string;

  @IsOptional()
  @IsBoolean()
  adultConfirmed?: boolean;
}
