-- Make candidate doj and pincode optional (nullable).
-- Idempotent: DROP NOT NULL is a no-op if the column is already nullable.
ALTER TABLE "candidates" ALTER COLUMN "doj" DROP NOT NULL;
ALTER TABLE "candidates" ALTER COLUMN "pincode" DROP NOT NULL;
