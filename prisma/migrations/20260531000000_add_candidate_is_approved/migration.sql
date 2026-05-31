-- Admin approval flag for candidates. Defaults to false (not yet approved).
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "isApproved" BOOLEAN NOT NULL DEFAULT false;
