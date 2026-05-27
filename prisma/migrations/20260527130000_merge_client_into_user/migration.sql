-- Merge Company into User: a "client" is now a User (role USER). There is no
-- Company entity anymore.
--
-- This migration is IDEMPOTENT so it is correct both on a fresh database (where
-- the companies table still exists) and on a database where an earlier,
-- non-transactional run already renamed the columns and dropped the table.

-- 1. Company -> User merge — only if the companies table still exists.
DO $$
BEGIN
  IF to_regclass('public.companies') IS NOT NULL THEN
    -- Drop the old company FKs.
    ALTER TABLE "stores" DROP CONSTRAINT IF EXISTS "stores_companyId_fkey";
    ALTER TABLE "candidates" DROP CONSTRAINT IF EXISTS "candidates_companyId_fkey";
    ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_companyId_fkey";
    ALTER TABLE "company_panel_pricing" DROP CONSTRAINT IF EXISTS "company_panel_pricing_companyId_fkey";

    -- Promote each company to a user (keep its id so companyId references resolve).
    -- ON CONFLICT DO NOTHING skips companies whose id/email already exist as a user.
    INSERT INTO "users" ("id", "email", "name", "mobile", "role", "isActive", "isEmailVerified", "createdAt", "updatedAt")
    SELECT c."id", c."billingEmail", c."name", c."contactMobile", 'USER', true, false, c."createdAt", CURRENT_TIMESTAMP
    FROM "companies" c
    ON CONFLICT DO NOTHING;

    -- Repoint references for companies whose email already belonged to a user.
    UPDATE "stores" t SET "companyId" = u."id"
      FROM "companies" c JOIN "users" u ON u."email" = c."billingEmail"
      WHERE t."companyId" = c."id" AND t."companyId" <> u."id";
    UPDATE "candidates" t SET "companyId" = u."id"
      FROM "companies" c JOIN "users" u ON u."email" = c."billingEmail"
      WHERE t."companyId" = c."id" AND t."companyId" <> u."id";
    UPDATE "bookings" t SET "companyId" = u."id"
      FROM "companies" c JOIN "users" u ON u."email" = c."billingEmail"
      WHERE t."companyId" = c."id" AND t."companyId" <> u."id";
    UPDATE "company_panel_pricing" t SET "companyId" = u."id"
      FROM "companies" c JOIN "users" u ON u."email" = c."billingEmail"
      WHERE t."companyId" = c."id" AND t."companyId" <> u."id";

    -- Rename companyId -> clientId.
    ALTER TABLE "stores" RENAME COLUMN "companyId" TO "clientId";
    ALTER TABLE "candidates" RENAME COLUMN "companyId" TO "clientId";
    ALTER TABLE "bookings" RENAME COLUMN "companyId" TO "clientId";
    ALTER TABLE "company_panel_pricing" RENAME COLUMN "companyId" TO "clientId";

    -- Rename the pricing table + its indexes, and the stores unique index.
    ALTER TABLE "company_panel_pricing" RENAME TO "client_panel_pricing";
    ALTER INDEX "company_panel_pricing_pkey" RENAME TO "client_panel_pricing_pkey";
    ALTER INDEX "company_panel_pricing_companyId_panelId_key" RENAME TO "client_panel_pricing_clientId_panelId_key";
    ALTER INDEX "stores_companyId_storeCode_key" RENAME TO "stores_clientId_storeCode_key";

    -- Users no longer belong to a company; drop the table.
    ALTER TABLE "users" DROP COLUMN IF EXISTS "companyId";
    DROP TABLE "companies";
  END IF;
END $$;

-- 2. Remove any operational rows whose client no longer exists (old company-era
--    data left behind when the table was dropped without merging). On a fresh DB
--    this deletes nothing because step 1 preserved every client as a user.
DELETE FROM "reports" r
  WHERE EXISTS (SELECT 1 FROM "bookings" b WHERE b."id" = r."bookingId" AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = b."clientId"))
     OR EXISTS (SELECT 1 FROM "candidates" c WHERE c."id" = r."candidateId" AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = c."clientId"));
DELETE FROM "bookings" b WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = b."clientId");
DELETE FROM "candidates" c WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = c."clientId");
DELETE FROM "client_panel_pricing" p WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = p."clientId");
DELETE FROM "stores" s WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = s."clientId");

-- 3. Add the clientId -> users(id) foreign keys if not already present.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stores_clientId_fkey') THEN
    ALTER TABLE "stores" ADD CONSTRAINT "stores_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'candidates_clientId_fkey') THEN
    ALTER TABLE "candidates" ADD CONSTRAINT "candidates_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_clientId_fkey') THEN
    ALTER TABLE "bookings" ADD CONSTRAINT "bookings_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_panel_pricing_clientId_fkey') THEN
    ALTER TABLE "client_panel_pricing" ADD CONSTRAINT "client_panel_pricing_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- 4. Drop the now-unused enum types (only the dropped companies table used them).
DROP TYPE IF EXISTS "CompanyStatus";
DROP TYPE IF EXISTS "CheckupFrequency";
