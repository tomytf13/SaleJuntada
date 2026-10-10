import { Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { AVATAR_MAX_LENGTH, AVATAR_PATTERN } from "./avatar";

export class AddParticipantDto {
  @ApiProperty({ example: "Sofi" })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: "+549381..." })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string"
      ? value.replace(/[\s()-]/g, "") || undefined
      : value,
  )
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message:
      "Ingresá el teléfono con código de país, por ejemplo +54 9 381 123 4567",
  })
  contact?: string;

  @ApiPropertyOptional({ example: "emoji:🦆" })
  @IsOptional()
  @IsString()
  @MaxLength(AVATAR_MAX_LENGTH)
  @Matches(AVATAR_PATTERN, {
    message:
      "El avatar debe ser un emoji, una imagen subida desde tu dispositivo, o tu foto de Google",
  })
  avatarUrl?: string;

  @ApiPropertyOptional({
    description:
      "Confirma que se quiere entrar aunque ya exista alguien con el mismo nombre",
  })
  @IsOptional()
  @IsBoolean()
  allowDuplicateName?: boolean;
}
