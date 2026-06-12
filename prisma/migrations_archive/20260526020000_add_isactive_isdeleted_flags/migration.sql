-- Add soft-delete / active flags.
ALTER TABLE "users" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "candidates" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "candidates" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
