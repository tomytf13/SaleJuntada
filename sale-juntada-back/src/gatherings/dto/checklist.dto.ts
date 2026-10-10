import { Transform } from "class-transformer";
import { IsIn, IsString, Length, ValidateIf } from "class-validator";

export class CreateChecklistItemDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @Length(2, 120)
  label!: string;
}

export class UpdateChecklistItemDto {
  @IsIn(["claim", "release", "ready", "pending", "assign"])
  action!: "claim" | "release" | "ready" | "pending" | "assign";

  @ValidateIf((dto: UpdateChecklistItemDto) => dto.action === "assign")
  @IsString()
  @Length(1, 100)
  assignedParticipantId?: string;
}
