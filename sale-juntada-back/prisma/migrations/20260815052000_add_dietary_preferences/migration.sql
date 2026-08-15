ALTER TABLE "Participant"
ADD COLUMN "dietaryPreferences" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "mealArrangement" TEXT;
