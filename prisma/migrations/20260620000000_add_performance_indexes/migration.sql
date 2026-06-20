-- Performance indexes for frequently-filtered foreign-key / status columns.
-- Postgres does NOT auto-index foreign keys, so every list/filter query on
-- these columns was doing a full table scan. See PERFORMANCE_ISSUES.md (#1).
--
-- Idempotent (IF NOT EXISTS) and named to match Prisma's @@index convention
-- ({table}_{column}_idx) so the schema and DB stay in sync. Safe to re-run.

-- ── bookings ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "bookings_candidateId_idx" ON "bookings" ("candidateId");
CREATE INDEX IF NOT EXISTS "bookings_clientId_idx"    ON "bookings" ("clientId");
CREATE INDEX IF NOT EXISTS "bookings_labId_idx"       ON "bookings" ("labId");
CREATE INDEX IF NOT EXISTS "bookings_status_idx"      ON "bookings" ("status");

-- ── candidates ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "candidates_clientId_idx"        ON "candidates" ("clientId");
CREATE INDEX IF NOT EXISTS "candidates_storeId_idx"         ON "candidates" ("storeId");
CREATE INDEX IF NOT EXISTS "candidates_appointmentDate_idx" ON "candidates" ("appointmentDate");

-- ── reports ──────────────────────────────────────────────────────────
-- bookingId is already @unique (indexed); only candidateId is missing.
CREATE INDEX IF NOT EXISTS "reports_candidateId_idx" ON "reports" ("candidateId");

-- ── stores ───────────────────────────────────────────────────────────
-- clientId is the leftmost column of @@unique([clientId, storeCode]) so it is
-- already index-covered; only cityId is missing.
CREATE INDEX IF NOT EXISTS "stores_cityId_idx" ON "stores" ("cityId");

-- ── cities ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "cities_zoneId_idx" ON "cities" ("zoneId");

-- ── client_panel_pricing ─────────────────────────────────────────────
-- clientId is leftmost of @@unique([clientId, panelId]); only panelId is missing.
CREATE INDEX IF NOT EXISTS "client_panel_pricing_panelId_idx" ON "client_panel_pricing" ("panelId");
