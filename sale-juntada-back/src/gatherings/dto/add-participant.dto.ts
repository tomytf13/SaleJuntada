import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class AddParticipantDto {
  @ApiProperty({ example: "Sofi" })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: "+549381..." })
  @IsOptional()
  @IsString()
  contact?: string;

  @ApiPropertyOptional({ example: "emoji:🦆" })
  @IsOptional()
  @IsString()
  @MaxLength(90000)
  avatarUrl?: string;
}
