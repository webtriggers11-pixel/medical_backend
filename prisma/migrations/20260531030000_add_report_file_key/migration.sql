-- Add S3 object key to report files (idempotent — safe to re-run)
ALTER TABLE "report_files" ADD COLUMN IF NOT EXISTS "fileKey" TEXT;
