import { IsBoolean, IsIn, IsOptional } from "class-validator";

export const purchaseResponsibilityActions = [
  "claim",
  "release",
  "ready",
  "pending",
] as const;

export type PurchaseResponsibilityAction =
  (typeof purchaseResponsibilityActions)[number];

export class UpdatePurchaseResponsibilityDto {
  @IsIn(purchaseResponsibilityActions)
  action!: PurchaseResponsibilityAction;

  @IsOptional()
  @IsBoolean()
  adultConfirmed?: boolean;
}
