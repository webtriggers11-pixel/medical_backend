-- Booking reschedule history (idempotent — safe to re-run against the live DB)
CREATE TABLE IF NOT EXISTS "booking_schedule_changes" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "previousDate" TIMESTAMP(3),
    "previousTimeSlot" TEXT,
    "newDate" TIMESTAMP(3),
    "newTimeSlot" TEXT,
    "reason" TEXT,
    "changedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "booking_schedule_changes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "booking_schedule_changes_bookingId_idx"
    ON "booking_schedule_changes"("bookingId");

DO $$ BEGIN
    ALTER TABLE "booking_schedule_changes"
        ADD CONSTRAINT "booking_schedule_changes_bookingId_fkey"
        FOREIGN KEY ("bookingId") REFERENCES "bookings"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
