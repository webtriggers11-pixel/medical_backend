-- Decouple Zone and City from Company.
-- Zones and Cities become standalone, global master data.

-- Drop foreign keys to companies
ALTER TABLE "zones" DROP CONSTRAINT "zones_companyId_fkey";
ALTER TABLE "cities" DROP CONSTRAINT "cities_companyId_fkey";

-- Drop the company columns
ALTER TABLE "zones" DROP COLUMN "companyId";
ALTER TABLE "cities" DROP COLUMN "companyId";
