import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class GoogleParticipantDto {
  @ApiProperty({ description: "Credencial ID emitida por Google Identity Services" })
  @IsString()
  @MinLength(20)
  credential: string;
}
