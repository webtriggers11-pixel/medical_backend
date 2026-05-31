-- Report-level metadata surfaced on the upload-report modal.
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "labInternalRef" TEXT;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "isInsure" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "approvalStatus" BOOLEAN NOT NULL DEFAULT false;

-- One report can bundle multiple uploaded files; each file is tagged with the
-- tests it covers ("Uploaded for"). testsCovered is a JSON array of test names.
CREATE TABLE IF NOT EXISTS "report_files" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "testsCovered" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "report_files_reportId_idx" ON "report_files"("reportId");

ALTER TABLE "report_files" DROP CONSTRAINT IF EXISTS "report_files_reportId_fkey";
ALTER TABLE "report_files" ADD CONSTRAINT "report_files_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
