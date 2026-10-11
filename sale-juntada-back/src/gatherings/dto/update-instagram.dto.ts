import { Transform } from "class-transformer";
import { IsString, Matches, MaxLength } from "class-validator";
export class UpdateInstagramDto {
  @Transform(({ value }: { value: unknown }) => typeof value === "string" ? value.trim().replace(/^@/, "").toLowerCase() : value)
  @IsString()
  @MaxLength(30)
  @Matches(/^(?:[a-z0-9_](?:[a-z0-9_.]*[a-z0-9_])?)?$/, { message: "Ingresá solo tu usuario de Instagram, sin enlaces ni espacios" })
  instagramUsername: string;
}
