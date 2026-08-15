import { IsOptional, IsString, MaxLength } from "class-validator";

export class AuthParticipantDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500_000)
  avatarUrl?: string;
}
