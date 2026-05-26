-- Replace the candidate schema with the new field set. The table is empty at
-- this point, so dropping and recreating is safe and avoids enum churn.
DROP TABLE IF EXISTS "candidates";
DROP TYPE IF EXISTS "CandidateStatus";

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');
CREATE TYPE "CandidateType" AS ENUM ('EXISTING', 'NEW');

-- CreateTable
CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "zone" TEXT,
    "city" TEXT,
    "store" TEXT,
    "name" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "mobileNumber" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "age" INTEGER NOT NULL,
    "candidateType" "CandidateType" NOT NULL,
    "dateOfJoining" TIMESTAMP(3) NOT NULL,
    "pincode" TEXT,
    "email" TEXT,
    "panNumber" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "candidates_createdById_idx" ON "candidates"("createdById");

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
