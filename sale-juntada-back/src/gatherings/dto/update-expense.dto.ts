import { Type } from "class-transformer";
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class UpdateExpenseDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  description!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amountCents!: number;
}
