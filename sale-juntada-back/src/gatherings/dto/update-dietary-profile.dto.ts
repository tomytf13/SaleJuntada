import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
} from "class-validator";

export const dietaryPreferences = ["CELIAC", "VEGAN", "VEGETARIAN"] as const;

export const mealArrangements = ["SELF_MANAGED", "GROUP_MENU"] as const;

export class UpdateDietaryProfileDto {
  @IsArray()
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsIn(dietaryPreferences, { each: true })
  dietaryPreferences!: Array<(typeof dietaryPreferences)[number]>;

  @IsOptional()
  @IsIn(mealArrangements)
  mealArrangement?: (typeof mealArrangements)[number] | null;
}
