import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class CreateGatheringDto {
  @ApiPropertyOptional({
    description: "Juntada propia de la que se copiarán configuración y cantidades",
  })
  @IsOptional()
  @IsString()
  templateGatheringId?: string;

  @ApiProperty({ example: "Asado con los pibes" })
  @IsString()
  @MinLength(3)
  title: string;

  @ApiProperty({ example: "Tomas" })
  @IsString()
  @MinLength(2)
  organizerName: string;

  @ApiPropertyOptional({ example: "emoji:🦆" })
  @IsOptional()
  @IsString()
  @MaxLength(90000)
  organizerAvatarUrl?: string;

  @ApiPropertyOptional({ example: "Yerba Buena" })
  @IsOptional()
  @IsString()
  locationHint?: string;

  @ApiPropertyOptional({ example: -26.8083 })
  @IsOptional()
  @IsLatitude()
  locationLatitude?: number;

  @ApiPropertyOptional({ example: -65.2176 })
  @IsOptional()
  @IsLongitude()
  locationLongitude?: number;

  @ApiProperty({ example: "2026-07-25T00:00:00.000Z" })
  @IsDateString()
  windowStart: string;

  @ApiProperty({ example: "2026-07-28T00:00:00.000Z" })
  @IsDateString()
  windowEnd: string;

  @ApiPropertyOptional({ default: 180 })
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(1440)
  durationMinutes?: number;

  @ApiPropertyOptional({ default: 1140, description: "Minutos desde las 00:00" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  dailyStartMinutes?: number;

  @ApiPropertyOptional({
    default: 1560,
    description: "Minutos desde las 00:00; puede superar 1440 si termina al día siguiente",
  })
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(2879)
  dailyEndMinutes?: number;

  @ApiPropertyOptional({ default: 60 })
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(720)
  slotStepMinutes?: number;
}
