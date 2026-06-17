-- Convert display IDs from prefix format (e.g. S-0000003) to plain numeric
-- format starting at 1000001. Existing rows are renumbered sequentially;
-- the id_sequences counter for each prefix is updated to the highest value used.

-- Helper: strips non-digit characters and casts to integer.
-- Used to preserve the original ordering of existing rows.

-- ── users (clientId, prefix CL) ──────────────────────────────────────
UPDATE "users"
SET "clientId" = sub."new_id"
FROM (
  SELECT "id",
         (1000000 + ROW_NUMBER() OVER (ORDER BY "createdAt" ASC))::text AS "new_id"
  FROM "users"
  WHERE "clientId" IS NOT NULL
) sub
WHERE "users"."id" = sub."id";

-- ── stores (storeId, prefix S) ───────────────────────────────────────
UPDATE "stores"
SET "storeId" = sub."new_id"
FROM (
  SELECT "id",
         (1000000 + ROW_NUMBER() OVER (ORDER BY "createdAt" ASC))::text AS "new_id"
  FROM "stores"
  WHERE "storeId" IS NOT NULL
) sub
WHERE "stores"."id" = sub."id";

-- ── labs (labId, prefix L) ───────────────────────────────────────────
UPDATE "labs"
SET "labId" = sub."new_id"
FROM (
  SELECT "id",
         (1000000 + ROW_NUMBER() OVER (ORDER BY "createdAt" ASC))::text AS "new_id"
  FROM "labs"
  WHERE "labId" IS NOT NULL
) sub
WHERE "labs"."id" = sub."id";

-- ── panels (panelId, prefix P) ───────────────────────────────────────
UPDATE "panels"
SET "panelId" = sub."new_id"
FROM (
  SELECT "id",
         (1000000 + ROW_NUMBER() OVER (ORDER BY "createdAt" ASC))::text AS "new_id"
  FROM "panels"
  WHERE "panelId" IS NOT NULL
) sub
WHERE "panels"."id" = sub."id";

-- ── candidates (candidateId, prefix C) ───────────────────────────────
UPDATE "candidates"
SET "candidateId" = sub."new_id"
FROM (
  SELECT "id",
         (1000000 + ROW_NUMBER() OVER (ORDER BY "createdAt" ASC))::text AS "new_id"
  FROM "candidates"
  WHERE "candidateId" IS NOT NULL
) sub
WHERE "candidates"."id" = sub."id";

-- ── bookings (bookingId, prefix B) ───────────────────────────────────
UPDATE "bookings"
SET "bookingId" = sub."new_id"
FROM (
  SELECT "id",
         (1000000 + ROW_NUMBER() OVER (ORDER BY "createdAt" ASC))::text AS "new_id"
  FROM "bookings"
  WHERE "bookingId" IS NOT NULL
) sub
WHERE "bookings"."id" = sub."id";

-- ── test_masters (testId, prefix T) ──────────────────────────────────
UPDATE "test_masters"
SET "testId" = sub."new_id"
FROM (
  SELECT "id",
         (1000000 + ROW_NUMBER() OVER (ORDER BY "createdAt" ASC))::text AS "new_id"
  FROM "test_masters"
  WHERE "testId" IS NOT NULL
) sub
WHERE "test_masters"."id" = sub."id";

-- ── Update id_sequences counters ─────────────────────────────────────
-- Set each counter to the highest used number so the next generate() call
-- returns highest + 1.

UPDATE "id_sequences" SET "nextVal" = COALESCE(
  (SELECT MAX("clientId"::bigint) FROM "users" WHERE "clientId" IS NOT NULL),
  1000000
) WHERE "prefix" = 'CL';

UPDATE "id_sequences" SET "nextVal" = COALESCE(
  (SELECT MAX("storeId"::bigint) FROM "stores" WHERE "storeId" IS NOT NULL),
  1000000
) WHERE "prefix" = 'S';

UPDATE "id_sequences" SET "nextVal" = COALESCE(
  (SELECT MAX("labId"::bigint) FROM "labs" WHERE "labId" IS NOT NULL),
  1000000
) WHERE "prefix" = 'L';

UPDATE "id_sequences" SET "nextVal" = COALESCE(
  (SELECT MAX("panelId"::bigint) FROM "panels" WHERE "panelId" IS NOT NULL),
  1000000
) WHERE "prefix" = 'P';

UPDATE "id_sequences" SET "nextVal" = COALESCE(
  (SELECT MAX("candidateId"::bigint) FROM "candidates" WHERE "candidateId" IS NOT NULL),
  1000000
) WHERE "prefix" = 'C';

UPDATE "id_sequences" SET "nextVal" = COALESCE(
  (SELECT MAX("bookingId"::bigint) FROM "bookings" WHERE "bookingId" IS NOT NULL),
  1000000
) WHERE "prefix" = 'B';

UPDATE "id_sequences" SET "nextVal" = COALESCE(
  (SELECT MAX("testId"::bigint) FROM "test_masters" WHERE "testId" IS NOT NULL),
  1000000
) WHERE "prefix" = 'T';
