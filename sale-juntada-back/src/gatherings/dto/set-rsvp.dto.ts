import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { RsvpStatus } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";

/**
 * Tope de acompañantes por persona.
 *
 * 10 alcanza de sobra para "voy con la familia" y evita que una sola
 * respuesta infle el headcount a cualquier número. Quien traiga más gente
 * que eso conviene que la sume como participante: así cada uno responde por
 * sí mismo y las cuentas de P3 no dependen de un entero suelto.
 */
export const MAX_PLUS_ONES = 10;

export class SetRsvpDto {
  @ApiProperty({ enum: RsvpStatus, example: RsvpStatus.GOING })
  @IsEnum(RsvpStatus, {
    message: "La respuesta debe ser GOING, MAYBE o NOT_GOING",
  })
  status!: RsvpStatus;

  @ApiPropertyOptional({
    default: 0,
    maximum: MAX_PLUS_ONES,
    description:
      "Acompañantes. El servidor lo fuerza a 0 si la respuesta no es GOING.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0, { message: "Los acompañantes no pueden ser un número negativo" })
  @Max(MAX_PLUS_ONES, {
    message: `Podés anotar hasta ${MAX_PLUS_ONES} acompañantes. Si son más, que cada uno se sume a la juntada.`,
  })
  plusOnes?: number;
}
