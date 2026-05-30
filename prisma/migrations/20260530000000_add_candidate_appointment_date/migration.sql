-- Appointment scheduling for candidates. A nullable date the candidate's health
-- checkup is scheduled for, captured in the Add Candidate flow and bulk upload.
-- Idempotent (IF NOT EXISTS) since this DB is a live, shared environment.
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "appointmentDate" TIMESTAMP(3);
