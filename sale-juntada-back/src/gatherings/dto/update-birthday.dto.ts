import { IsBoolean, IsString, MaxLength, MinLength } from "class-validator";
export class UpdateBirthdayDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  targetParticipantId: string;

  @IsBoolean()
  isBirthdayPerson: boolean;
}
