import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class PurchaseQuantityDto {
  @IsString()
  @MaxLength(32)
  key!: string;

  @IsInt()
  @Min(0)
  @Max(999)
  quantity!: number;
}

export class UpdatePurchasePlanDto {
  @IsBoolean()
  includeAlcohol!: boolean;

  @IsBoolean()
  ageConfirmed!: boolean;

  @IsArray()
  @ArrayMaxSize(16)
  @ValidateNested({ each: true })
  @Type(() => PurchaseQuantityDto)
  items!: PurchaseQuantityDto[];
}
