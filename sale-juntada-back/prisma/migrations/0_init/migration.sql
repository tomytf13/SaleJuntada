-- Baseline de Sale Juntada.
--
-- Reemplaza las 19 migraciones incrementales anteriores, que se acumularon
-- durante el prototipado. Contiene todo lo necesario para levantar la base
-- desde cero y nada más: no quedan tablas que se creaban para borrarse
-- después (Proposal), backfills de filas que en una base nueva no existen,
-- ni el REVOKE sobre `public.rls_auto_enable()` —una función que crea
-- Supabase— que hacía fallar cualquier reconstrucción fuera de Supabase.
--
-- Se generó con:
--   prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma
-- y se le sumó a mano el SQL que Prisma no deriva del schema: el endurecimiento
-- de RLS/permisos y los datos de referencia del catálogo de compras.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "GatheringStatus" AS ENUM ('DRAFT', 'OPEN', 'PROPOSED', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AvailabilityKind" AS ENUM ('AVAILABLE', 'MAYBE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "PurchaseCategory" AS ENUM ('FOOD', 'DRINKS', 'OTHER', 'ALCOHOL');

-- CreateTable
CREATE TABLE "Gathering" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "locationHint" TEXT,
    "locationLatitude" DOUBLE PRECISION,
    "locationLongitude" DOUBLE PRECISION,
    "organizerName" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 180,
    "dailyStartMinutes" INTEGER NOT NULL DEFAULT 780,
    "dailyEndMinutes" INTEGER NOT NULL DEFAULT 1440,
    "slotStepMinutes" INTEGER NOT NULL DEFAULT 480,
    "status" "GatheringStatus" NOT NULL DEFAULT 'OPEN',
    "finalizedStart" TIMESTAMP(3),
    "finalizedEnd" TIMESTAMP(3),
    "finalizedLocation" TEXT,
    "expenseRound" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gathering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "gatheringId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "avatarUrl" TEXT,
    "authUserId" TEXT,
    "dietaryPreferences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mealArrangement" TEXT,
    "paymentAlias" TEXT,
    "isOrganizer" BOOLEAN NOT NULL DEFAULT false,
    "responseToken" TEXT NOT NULL,
    "expensesReadyAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPaymentProfile" (
    "authUserId" TEXT NOT NULL,
    "paymentAlias" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPaymentProfile_pkey" PRIMARY KEY ("authUserId")
);

-- CreateTable
CREATE TABLE "Availability" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "kind" "AvailabilityKind" NOT NULL DEFAULT 'AVAILABLE',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "gatheringId" TEXT NOT NULL,
    "paidByParticipantId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferConfirmation" (
    "id" TEXT NOT NULL,
    "gatheringId" TEXT NOT NULL,
    "fromParticipantId" TEXT NOT NULL,
    "toParticipantId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "expenseRound" INTEGER NOT NULL DEFAULT 1,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchasePlan" (
    "id" TEXT NOT NULL,
    "gatheringId" TEXT NOT NULL,
    "includeAlcohol" BOOLEAN NOT NULL DEFAULT false,
    "ageConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "participantBaseline" INTEGER NOT NULL DEFAULT 1,
    "updatedByParticipantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchasePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseItem" (
    "id" TEXT NOT NULL,
    "purchasePlanId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "category" "PurchaseCategory" NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "assignedParticipantId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "isReady" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseContribution" (
    "id" TEXT NOT NULL,
    "purchaseItemId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "catalogProductId" TEXT,
    "catalogPresentationId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'unidad',
    "note" TEXT,
    "isReady" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogProduct" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "description" TEXT,
    "visualKey" TEXT NOT NULL,
    "accentColor" TEXT NOT NULL DEFAULT '#ff6b35',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isAlcohol" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogPresentation" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogPresentation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Gathering_slug_key" ON "Gathering"("slug");

-- CreateIndex
CREATE INDEX "Gathering_status_windowStart_idx" ON "Gathering"("status", "windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_responseToken_key" ON "Participant"("responseToken");

-- CreateIndex
CREATE INDEX "Participant_gatheringId_idx" ON "Participant"("gatheringId");

-- CreateIndex
CREATE INDEX "Participant_authUserId_idx" ON "Participant"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_gatheringId_authUserId_key" ON "Participant"("gatheringId", "authUserId");

-- CreateIndex
CREATE INDEX "Availability_startsAt_endsAt_idx" ON "Availability"("startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Availability_participantId_startsAt_endsAt_key" ON "Availability"("participantId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "Expense_gatheringId_createdAt_idx" ON "Expense"("gatheringId", "createdAt");

-- CreateIndex
CREATE INDEX "Expense_paidByParticipantId_idx" ON "Expense"("paidByParticipantId");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_gatheringId_idempotencyKey_key" ON "Expense"("gatheringId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "TransferConfirmation_gatheringId_idx" ON "TransferConfirmation"("gatheringId");

-- CreateIndex
CREATE INDEX "TransferConfirmation_fromParticipantId_idx" ON "TransferConfirmation"("fromParticipantId");

-- CreateIndex
CREATE INDEX "TransferConfirmation_toParticipantId_idx" ON "TransferConfirmation"("toParticipantId");

-- CreateIndex
CREATE UNIQUE INDEX "TransferConfirmation_round_pair_key" ON "TransferConfirmation"("gatheringId", "expenseRound", "fromParticipantId", "toParticipantId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchasePlan_gatheringId_key" ON "PurchasePlan"("gatheringId");

-- CreateIndex
CREATE INDEX "PurchasePlan_updatedByParticipantId_idx" ON "PurchasePlan"("updatedByParticipantId");

-- CreateIndex
CREATE INDEX "PurchaseItem_purchasePlanId_position_idx" ON "PurchaseItem"("purchasePlanId", "position");

-- CreateIndex
CREATE INDEX "PurchaseItem_assignedParticipantId_idx" ON "PurchaseItem"("assignedParticipantId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseItem_purchasePlanId_key_key" ON "PurchaseItem"("purchasePlanId", "key");

-- CreateIndex
CREATE INDEX "PurchaseContribution_purchaseItemId_updatedAt_idx" ON "PurchaseContribution"("purchaseItemId", "updatedAt");

-- CreateIndex
CREATE INDEX "PurchaseContribution_participantId_idx" ON "PurchaseContribution"("participantId");

-- CreateIndex
CREATE INDEX "PurchaseContribution_catalogProductId_idx" ON "PurchaseContribution"("catalogProductId");

-- CreateIndex
CREATE INDEX "PurchaseContribution_catalogPresentationId_idx" ON "PurchaseContribution"("catalogPresentationId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseContribution_purchaseItemId_participantId_key" ON "PurchaseContribution"("purchaseItemId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogProduct_key_key" ON "CatalogProduct"("key");

-- CreateIndex
CREATE INDEX "CatalogProduct_categoryKey_isActive_position_idx" ON "CatalogProduct"("categoryKey", "isActive", "position");

-- CreateIndex
CREATE INDEX "CatalogPresentation_productId_isActive_position_idx" ON "CatalogPresentation"("productId", "isActive", "position");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogPresentation_productId_key_key" ON "CatalogPresentation"("productId", "key");

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_gatheringId_fkey" FOREIGN KEY ("gatheringId") REFERENCES "Gathering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_gatheringId_fkey" FOREIGN KEY ("gatheringId") REFERENCES "Gathering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paidByParticipantId_fkey" FOREIGN KEY ("paidByParticipantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferConfirmation" ADD CONSTRAINT "TransferConfirmation_gatheringId_fkey" FOREIGN KEY ("gatheringId") REFERENCES "Gathering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferConfirmation" ADD CONSTRAINT "TransferConfirmation_fromParticipantId_fkey" FOREIGN KEY ("fromParticipantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferConfirmation" ADD CONSTRAINT "TransferConfirmation_toParticipantId_fkey" FOREIGN KEY ("toParticipantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasePlan" ADD CONSTRAINT "PurchasePlan_gatheringId_fkey" FOREIGN KEY ("gatheringId") REFERENCES "Gathering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasePlan" ADD CONSTRAINT "PurchasePlan_updatedByParticipantId_fkey" FOREIGN KEY ("updatedByParticipantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_purchasePlanId_fkey" FOREIGN KEY ("purchasePlanId") REFERENCES "PurchasePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_assignedParticipantId_fkey" FOREIGN KEY ("assignedParticipantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseContribution" ADD CONSTRAINT "PurchaseContribution_purchaseItemId_fkey" FOREIGN KEY ("purchaseItemId") REFERENCES "PurchaseItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseContribution" ADD CONSTRAINT "PurchaseContribution_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseContribution" ADD CONSTRAINT "PurchaseContribution_catalogProductId_fkey" FOREIGN KEY ("catalogProductId") REFERENCES "CatalogProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseContribution" ADD CONSTRAINT "PurchaseContribution_catalogPresentationId_fkey" FOREIGN KEY ("catalogPresentationId") REFERENCES "CatalogPresentation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogPresentation" ADD CONSTRAINT "CatalogPresentation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CatalogProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Endurecimiento de acceso
-- ---------------------------------------------------------------------------
-- Prisma no modela RLS ni permisos, así que esto no sale del schema y hay que
-- mantenerlo acá.
--
-- El acceso a los datos es EXCLUSIVAMENTE por la API: el backend se conecta con
-- su propio rol y el frontend usa Supabase sólo para autenticación, nunca para
-- consultar estas tablas. RLS activo sin políticas deja todo denegado para
-- `anon` y `authenticated`, que es justo lo que queremos: si alguien algún día
-- apunta el cliente del navegador contra una de estas tablas, no lee nada.
--
-- Antes esto estaba repartido en cinco migraciones y era inconsistente: las
-- once tablas tenían RLS, pero sólo cuatro tenían REVOKE. Acá se aplica el
-- mismo criterio a todas.
ALTER TABLE "Gathering" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Participant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Availability" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TransferConfirmation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchasePlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseContribution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CatalogProduct" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CatalogPresentation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserPaymentProfile" ENABLE ROW LEVEL SECURITY;

-- `anon` y `authenticated` son roles que crea Supabase, no Postgres. Sin esto
-- los REVOKE de abajo fallan con "role does not exist" en una Postgres común
-- —local, shadow o CI— y la base no se puede reconstruir. Se crean si faltan,
-- sin permiso de login, para que el endurecimiento se aplique igual en todos
-- los entornos en vez de saltearse en silencio donde los roles no existan.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;

REVOKE ALL ON TABLE "Gathering" FROM anon, authenticated;
REVOKE ALL ON TABLE "Participant" FROM anon, authenticated;
REVOKE ALL ON TABLE "Availability" FROM anon, authenticated;
REVOKE ALL ON TABLE "Expense" FROM anon, authenticated;
REVOKE ALL ON TABLE "TransferConfirmation" FROM anon, authenticated;
REVOKE ALL ON TABLE "PurchasePlan" FROM anon, authenticated;
REVOKE ALL ON TABLE "PurchaseItem" FROM anon, authenticated;
REVOKE ALL ON TABLE "PurchaseContribution" FROM anon, authenticated;
REVOKE ALL ON TABLE "CatalogProduct" FROM anon, authenticated;
REVOKE ALL ON TABLE "CatalogPresentation" FROM anon, authenticated;
REVOKE ALL ON TABLE "UserPaymentProfile" FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Catálogo de compras (datos de referencia)
-- ---------------------------------------------------------------------------
-- No son datos de usuario: es el catálogo que la aplicación sirve en
-- `GET /api/gatherings/catalog/purchase`. Sin esto la pantalla de compras
-- queda vacía, así que va en la migración y no en el seed.

INSERT INTO "CatalogProduct" ("id", "key", "categoryKey", "name", "brand", "description", "visualKey", "accentColor", "tags", "isAlcohol", "position", "updatedAt") VALUES
('catalog-main-asado', 'main-asado', 'meat', 'Asado', NULL, 'Carne y achuras para la parrilla', 'grill', '#d95f3b', ARRAY['clásico'], false, 10, CURRENT_TIMESTAMP),
('catalog-main-burgers', 'main-burgers', 'meat', 'Hamburguesas', NULL, 'Hamburguesas para armar', 'burger', '#e28a31', ARRAY['rápido'], false, 20, CURRENT_TIMESTAMP),
('catalog-main-pizza', 'main-pizza', 'meat', 'Pizza', NULL, 'Pizzas o prepizzas', 'pizza', '#dd5b45', ARRAY['para compartir'], false, 30, CURRENT_TIMESTAMP),
('catalog-main-empanadas', 'main-empanadas', 'meat', 'Empanadas', NULL, 'Variedad de empanadas', 'empanada', '#c67b39', ARRAY['tucumano'], false, 40, CURRENT_TIMESTAMP),
('catalog-main-sandwiches', 'main-sandwiches', 'meat', 'Sándwiches', NULL, 'Sándwiches o sánguches', 'sandwich', '#bf7144', ARRAY['práctico'], false, 50, CURRENT_TIMESTAMP),
('catalog-main-veggie', 'main-veggie', 'meat', 'Principal vegetariano', NULL, 'Opción sin carne para compartir', 'veggie', '#5c9b52', ARRAY['vegetariano'], false, 60, CURRENT_TIMESTAMP),
('catalog-side-salad', 'side-salad', 'salad', 'Ensalada', NULL, 'Ensalada fresca', 'salad', '#4d9d67', ARRAY['vegano'], false, 10, CURRENT_TIMESTAMP),
('catalog-side-bread', 'side-bread', 'salad', 'Pan', NULL, 'Pan, tortillas o figazas', 'bread', '#bd7a3f', ARRAY[]::TEXT[], false, 20, CURRENT_TIMESTAMP),
('catalog-side-potatoes', 'side-potatoes', 'salad', 'Papas o guarnición', NULL, 'Papas, puré u otra guarnición', 'potatoes', '#d6a93f', ARRAY['guarnición'], false, 30, CURRENT_TIMESTAMP),
('catalog-side-sauces', 'side-sauces', 'salad', 'Salsas y aderezos', NULL, 'Chimichurri, mayonesa y aderezos', 'sauce', '#d05b48', ARRAY[]::TEXT[], false, 40, CURRENT_TIMESTAMP),
('catalog-snack-chips', 'snack-chips', 'snacks', 'Papas fritas', NULL, 'Papas crocantes para picar', 'chips', '#dfaa2f', ARRAY['salado'], false, 10, CURRENT_TIMESTAMP),
('catalog-snack-nachos', 'snack-nachos', 'snacks', 'Nachos', NULL, 'Nachos o tortillas de maíz', 'nachos', '#e48427', ARRAY['salado'], false, 20, CURRENT_TIMESTAMP),
('catalog-snack-peanuts', 'snack-peanuts', 'snacks', 'Maní', NULL, 'Maní salado o saborizado', 'peanuts', '#bc7b36', ARRAY['salado'], false, 30, CURRENT_TIMESTAMP),
('catalog-snack-sticks', 'snack-sticks', 'snacks', 'Palitos salados', NULL, 'Palitos para picar', 'sticks', '#d39a3b', ARRAY['salado'], false, 40, CURRENT_TIMESTAMP),
('catalog-snack-cheese', 'snack-cheese', 'snacks', 'Snack de queso', NULL, 'Chizitos o snack sabor queso', 'cheese-snack', '#e2702b', ARRAY['salado'], false, 50, CURRENT_TIMESTAMP),
('catalog-snack-mix', 'snack-mix', 'snacks', 'Mix para picar', NULL, 'Mezcla de snacks y frutos secos', 'snack-mix', '#aa7442', ARRAY['para compartir'], false, 60, CURRENT_TIMESTAMP),
('catalog-dessert-icecream', 'dessert-icecream', 'dessert', 'Helado', NULL, 'Helado para compartir', 'icecream', '#d66a91', ARRAY['frío'], false, 10, CURRENT_TIMESTAMP),
('catalog-dessert-cake', 'dessert-cake', 'dessert', 'Torta', NULL, 'Torta o bizcochuelo', 'cake', '#c55f78', ARRAY['dulce'], false, 20, CURRENT_TIMESTAMP),
('catalog-dessert-flan', 'dessert-flan', 'dessert', 'Flan', NULL, 'Flan con dulce de leche o crema', 'flan', '#d79937', ARRAY['clásico'], false, 30, CURRENT_TIMESTAMP),
('catalog-dessert-fruit', 'dessert-fruit', 'dessert', 'Fruta', NULL, 'Fruta fresca o ensalada de frutas', 'fruit', '#62a74d', ARRAY['vegano'], false, 40, CURRENT_TIMESTAMP),
('catalog-dessert-sweets', 'dessert-sweets', 'dessert', 'Alfajores y dulces', NULL, 'Algo dulce individual', 'sweets', '#8f5c45', ARRAY['individual'], false, 50, CURRENT_TIMESTAMP),
('catalog-soda-cola', 'soda-cola', 'soda', 'Gaseosa cola', NULL, 'Gaseosa sabor cola', 'cola', '#9a4337', ARRAY['gaseosa'], false, 10, CURRENT_TIMESTAMP),
('catalog-soda-cola-zero', 'soda-cola-zero', 'soda', 'Gaseosa cola sin azúcar', NULL, 'Alternativa cola sin azúcar', 'cola-zero', '#3f4148', ARRAY['sin azúcar'], false, 20, CURRENT_TIMESTAMP),
('catalog-soda-lemonlime', 'soda-lemonlime', 'soda', 'Gaseosa lima-limón', NULL, 'Gaseosa cítrica', 'lemon-lime', '#72a846', ARRAY['gaseosa'], false, 30, CURRENT_TIMESTAMP),
('catalog-soda-orange', 'soda-orange', 'soda', 'Gaseosa naranja', NULL, 'Gaseosa sabor naranja', 'orange-soda', '#ef7c25', ARRAY['gaseosa'], false, 40, CURRENT_TIMESTAMP),
('catalog-soda-water', 'soda-water', 'soda', 'Agua mineral', NULL, 'Agua con o sin gas', 'water', '#348cad', ARRAY['sin azúcar'], false, 50, CURRENT_TIMESTAMP),
('catalog-soda-flavored-water', 'soda-flavored-water', 'soda', 'Agua saborizada', NULL, 'Agua saborizada', 'flavored-water', '#4e9c91', ARRAY['sin alcohol'], false, 60, CURRENT_TIMESTAMP),
('catalog-soda-juice', 'soda-juice', 'soda', 'Jugo', NULL, 'Jugo listo o para preparar', 'juice', '#e68c2f', ARRAY['sin alcohol'], false, 70, CURRENT_TIMESTAMP),
('catalog-ice-bag', 'ice-bag', 'ice', 'Hielo', NULL, 'Bolsa de hielo', 'ice', '#48a8c6', ARRAY['frío'], false, 10, CURRENT_TIMESTAMP),
('catalog-fire-charcoal', 'fire-charcoal', 'charcoal', 'Carbón', NULL, 'Carbón para parrilla', 'charcoal', '#4c4b49', ARRAY['parrilla'], false, 10, CURRENT_TIMESTAMP),
('catalog-fire-wood', 'fire-wood', 'charcoal', 'Leña', NULL, 'Leña para el fuego', 'wood', '#895d3b', ARRAY['parrilla'], false, 20, CURRENT_TIMESTAMP),
('catalog-fire-lighter', 'fire-lighter', 'charcoal', 'Encendedor y fósforos', NULL, 'Para prender el fuego', 'lighter', '#e6652e', ARRAY['parrilla'], false, 30, CURRENT_TIMESTAMP),
('catalog-alcohol-beer', 'alcohol-beer', 'beer', 'Cerveza', NULL, 'Cerveza con alcohol', 'beer', '#d9902f', ARRAY['+18'], true, 10, CURRENT_TIMESTAMP),
('catalog-alcohol-fernet', 'alcohol-fernet', 'beer', 'Fernet', NULL, 'Aperitivo amargo con alcohol', 'fernet', '#59483e', ARRAY['+18'], true, 20, CURRENT_TIMESTAMP),
('catalog-alcohol-red-wine', 'alcohol-red-wine', 'beer', 'Vino tinto', NULL, 'Vino tinto', 'red-wine', '#7c3146', ARRAY['+18'], true, 30, CURRENT_TIMESTAMP),
('catalog-alcohol-white-wine', 'alcohol-white-wine', 'beer', 'Vino blanco', NULL, 'Vino blanco', 'white-wine', '#c5a849', ARRAY['+18'], true, 40, CURRENT_TIMESTAMP),
('catalog-alcohol-gin', 'alcohol-gin', 'beer', 'Gin', NULL, 'Gin con alcohol', 'gin', '#5c8190', ARRAY['+18'], true, 50, CURRENT_TIMESTAMP),
('catalog-alcohol-vodka', 'alcohol-vodka', 'beer', 'Vodka', NULL, 'Vodka con alcohol', 'vodka', '#71828a', ARRAY['+18'], true, 60, CURRENT_TIMESTAMP),
('catalog-alcohol-cider', 'alcohol-cider', 'beer', 'Sidra', NULL, 'Sidra con alcohol', 'cider', '#9e8738', ARRAY['+18'], true, 70, CURRENT_TIMESTAMP),
('catalog-other-cups', 'other-cups', 'other', 'Vasos', NULL, 'Vasos reutilizables o descartables', 'cups', '#7d69ad', ARRAY['servicio'], false, 10, CURRENT_TIMESTAMP),
('catalog-other-tableware', 'other-tableware', 'other', 'Platos y cubiertos', NULL, 'Vajilla para servir', 'tableware', '#6679a8', ARRAY['servicio'], false, 20, CURRENT_TIMESTAMP),
('catalog-other-napkins', 'other-napkins', 'other', 'Servilletas', NULL, 'Servilletas de papel', 'napkins', '#9295a2', ARRAY['servicio'], false, 30, CURRENT_TIMESTAMP),
('catalog-other-bags', 'other-bags', 'other', 'Bolsas de residuos', NULL, 'Bolsas para dejar todo limpio', 'trash-bag', '#52666b', ARRAY['limpieza'], false, 40, CURRENT_TIMESTAMP);

WITH presentation_data("productKey", "key", "label", "unit", "position") AS (VALUES
('main-asado','kg','Por kilo','kg',10), ('main-asado','tray','Bandeja','bandejas',20),
('main-burgers','pack4','Pack x4','packs de 4',10), ('main-burgers','pack6','Pack x6','packs de 6',20),
('main-pizza','unit','Unidad','pizzas',10), ('main-pizza','large','Pizza grande','pizzas grandes',20),
('main-empanadas','dozen','Docena','docenas',10), ('main-empanadas','half-dozen','Media docena','medias docenas',20),
('main-sandwiches','unit','Unidad','sándwiches',10), ('main-sandwiches','dozen','Docena','docenas',20),
('main-veggie','portion','Porción','porciones',10), ('main-veggie','tray','Bandeja','bandejas',20),
('side-salad','bowl','Ensaladera','ensaladeras',10), ('side-salad','portion','Porción','porciones',20),
('side-bread','kg','Por kilo','kg',10), ('side-bread','unit','Unidad','unidades',20),
('side-potatoes','kg','Por kilo','kg',10), ('side-potatoes','tray','Bandeja','bandejas',20),
('side-sauces','jar','Frasco','frascos',10), ('side-sauces','bottle','Botella','botellas',20),
('snack-chips','small','Bolsa chica','bolsas chicas',10), ('snack-chips','large','Bolsa grande','bolsas grandes',20),
('snack-nachos','small','Bolsa chica','bolsas chicas',10), ('snack-nachos','large','Bolsa grande','bolsas grandes',20),
('snack-peanuts','250g','Paquete 250 g','paquetes de 250 g',10), ('snack-peanuts','500g','Paquete 500 g','paquetes de 500 g',20),
('snack-sticks','small','Bolsa chica','bolsas chicas',10), ('snack-sticks','large','Bolsa grande','bolsas grandes',20),
('snack-cheese','small','Bolsa chica','bolsas chicas',10), ('snack-cheese','large','Bolsa grande','bolsas grandes',20),
('snack-mix','250g','Paquete 250 g','paquetes de 250 g',10), ('snack-mix','500g','Paquete 500 g','paquetes de 500 g',20),
('dessert-icecream','kg','Kilo','kg de helado',10), ('dessert-icecream','pot','Pote','potes',20),
('dessert-cake','unit','Unidad','tortas',10), ('dessert-cake','portion','Porción','porciones',20),
('dessert-flan','unit','Unidad','flanes',10), ('dessert-flan','portion','Porción','porciones',20),
('dessert-fruit','kg','Por kilo','kg',10), ('dessert-fruit','bowl','Ensaladera','ensaladeras',20),
('dessert-sweets','unit','Unidad','unidades',10), ('dessert-sweets','box','Caja','cajas',20),
('soda-cola','2250ml','Botella 2,25 L','botellas de 2,25 L',10), ('soda-cola','1500ml','Botella 1,5 L','botellas de 1,5 L',20), ('soda-cola','can','Lata','latas',30),
('soda-cola-zero','2250ml','Botella 2,25 L','botellas de 2,25 L',10), ('soda-cola-zero','1500ml','Botella 1,5 L','botellas de 1,5 L',20), ('soda-cola-zero','can','Lata','latas',30),
('soda-lemonlime','2250ml','Botella 2,25 L','botellas de 2,25 L',10), ('soda-lemonlime','1500ml','Botella 1,5 L','botellas de 1,5 L',20),
('soda-orange','2250ml','Botella 2,25 L','botellas de 2,25 L',10), ('soda-orange','1500ml','Botella 1,5 L','botellas de 1,5 L',20),
('soda-water','2250ml','Botella 2,25 L','botellas de 2,25 L',10), ('soda-water','1500ml','Botella 1,5 L','botellas de 1,5 L',20), ('soda-water','500ml','Botella 500 ml','botellas de 500 ml',30),
('soda-flavored-water','1500ml','Botella 1,5 L','botellas de 1,5 L',10), ('soda-flavored-water','500ml','Botella 500 ml','botellas de 500 ml',20),
('soda-juice','1000ml','Envase 1 L','envases de 1 L',10), ('soda-juice','sachet','Sobre para preparar','sobres',20),
('ice-bag','2kg','Bolsa 2 kg','bolsas de 2 kg',10), ('ice-bag','4kg','Bolsa 4 kg','bolsas de 4 kg',20),
('fire-charcoal','3kg','Bolsa 3 kg','bolsas de 3 kg',10), ('fire-charcoal','5kg','Bolsa 5 kg','bolsas de 5 kg',20),
('fire-wood','bundle','Atado','atados',10), ('fire-wood','bag','Bolsa','bolsas',20),
('fire-lighter','unit','Unidad','unidades',10), ('fire-lighter','pack','Paquete','paquetes',20),
('alcohol-beer','can','Lata','latas',10), ('alcohol-beer','liter','Botella 1 L','botellas de 1 L',20), ('alcohol-beer','sixpack','Six pack','six packs',30),
('alcohol-fernet','750ml','Botella 750 ml','botellas de 750 ml',10), ('alcohol-fernet','1000ml','Botella 1 L','botellas de 1 L',20),
('alcohol-red-wine','750ml','Botella 750 ml','botellas de 750 ml',10), ('alcohol-white-wine','750ml','Botella 750 ml','botellas de 750 ml',10),
('alcohol-gin','750ml','Botella 750 ml','botellas de 750 ml',10), ('alcohol-vodka','750ml','Botella 750 ml','botellas de 750 ml',10),
('alcohol-cider','750ml','Botella 750 ml','botellas de 750 ml',10),
('other-cups','pack25','Pack x25','packs de 25',10), ('other-cups','pack50','Pack x50','packs de 50',20),
('other-tableware','pack10','Pack x10','packs de 10',10), ('other-tableware','pack25','Pack x25','packs de 25',20),
('other-napkins','pack','Paquete','paquetes',10), ('other-bags','roll','Rollo','rollos',10), ('other-bags','pack','Paquete','paquetes',20)
)
INSERT INTO "CatalogPresentation" ("id", "productId", "key", "label", "unit", "position", "updatedAt")
SELECT 'presentation-' || product."key" || '-' || data."key", product."id", data."key", data."label", data."unit", data."position", CURRENT_TIMESTAMP
FROM presentation_data data
JOIN "CatalogProduct" product ON product."key" = data."productKey";
