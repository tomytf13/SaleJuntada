ALTER TABLE "Participant"
ADD COLUMN "paymentAlias" TEXT;

ALTER TABLE "Participant"
ADD CONSTRAINT "Participant_paymentAlias_format_check"
CHECK (
  "paymentAlias" IS NULL
  OR "paymentAlias" ~ '^[A-Za-z0-9.-]{6,20}$'
);

CREATE TABLE "UserPaymentProfile" (
  "authUserId" TEXT NOT NULL,
  "paymentAlias" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserPaymentProfile_pkey" PRIMARY KEY ("authUserId"),
  CONSTRAINT "UserPaymentProfile_paymentAlias_format_check" CHECK (
    "paymentAlias" IS NULL
    OR "paymentAlias" ~ '^[A-Za-z0-9.-]{6,20}$'
  )
);

ALTER TABLE "UserPaymentProfile" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "UserPaymentProfile" FROM anon, authenticated;
