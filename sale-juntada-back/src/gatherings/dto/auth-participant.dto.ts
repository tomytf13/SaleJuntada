import { Transform } from "class-transformer";
import { IsOptional, IsString, Matches, MaxLength } from "class-validator";

export class AuthParticipantDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  /** Teléfono de contacto declarado; no acredita titularidad. */
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

  @IsOptional()
  @IsString()
  @MaxLength(500_000)
  avatarUrl?: string;
}
