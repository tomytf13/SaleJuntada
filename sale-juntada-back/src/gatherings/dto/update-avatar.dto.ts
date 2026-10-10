import { IsString, Matches, MaxLength } from "class-validator";
import { AVATAR_MAX_LENGTH, AVATAR_PATTERN } from "./avatar";

export class UpdateAvatarDto {
  @IsString()
  @MaxLength(AVATAR_MAX_LENGTH)
  @Matches(AVATAR_PATTERN, {
    message: "Elegí un ícono o subí una imagen válida",
  })
  avatarUrl: string;
}
