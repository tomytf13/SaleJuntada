import { IsString, Matches } from "class-validator";

export class UpdatePaymentAliasDto {
  @IsString()
  @Matches(/^(?:[A-Za-z0-9.-]{6,20})?$/, {
    message:
      "El alias debe tener entre 6 y 20 caracteres: letras, números, punto o guion",
  })
  paymentAlias!: string;
}
