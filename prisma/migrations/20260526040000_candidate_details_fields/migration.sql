-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "panNumber" TEXT,
ADD COLUMN     "pincode" TEXT NOT NULL,
ALTER COLUMN "doj" SET NOT NULL;

