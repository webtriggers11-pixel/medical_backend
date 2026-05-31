# FEATURE_SPEC — Unique Display ID Generation (All Modules)
> Created: 2026-05-31 | Folder: vibe/features/2026-05-31-unique-display-ids/

---

## 1. Feature overview

Every record across 9 modules gets a human-readable, prefix-sequential display ID (e.g. `B001`, `CL003`) auto-generated at creation time. The internal `id` (cuid) remains the primary key — `displayId` is a separate, immutable, unique display reference stored on each record. This gives users a consistent, short reference number for searching, reporting, and tracking without changing any existing keys or relationships.

---

## 2. User stories

| Who | Does what | Outcome |
|-----|-----------|---------|
| Admin | Creates a new booking | Record is automatically assigned `B001`, `B002`, etc. |
| Admin | Views the Clients list | Each client row shows its `CL001` ID |
| Admin | Searches by "B005" | Can find and reference the exact booking |
| System | Creates any record | `displayId` is generated atomically — no duplicates |

---

## 3. Module prefix table

| Module | DB model | Prefix | Example |
|--------|----------|--------|---------|
| Booking | `Booking` | `B` | B001, B002 |
| Store | `Store` | `S` | S001, S002 |
| Candidate | `Candidate` | `C` | C001, C002 |
| Lab | `Lab` | `L` | L001, L002 |
| Client (User role=USER) | `User` | `CL` | CL001, CL002 |
| Panel | `Panel` | `P` | P001, P002 |
| Test Master | `TestMaster` | `T` | T001, T002 |
| Zone | `Zone` | `Z` | Z001, Z002 |
| City | `City` | `CT` | CT001, CT002 |

---

## 4. Acceptance criteria

### Generation
- [ ] On every `create()` call for the 9 models, `displayId` is set automatically
- [ ] `displayId` uses format `${PREFIX}${n.toString().padStart(3, '0')}` — grows beyond 3 digits naturally (B999 → B1000)
- [ ] Generation is **atomic** — no two records can get the same displayId (uses DB-level counter in a transaction)
- [ ] `displayId` is stored as `String @unique` on each model — immutable after creation (no service method updates it)
- [ ] Existing records (pre-feature) get `displayId = null` — shown as `—` in UI; a one-time backfill script is provided but not required to run

### Display — UI
- [ ] All listing pages show `displayId` as the first column
- [ ] Detail pages show `displayId` in the header/info card
- [ ] Null `displayId` on old records renders as `—` (no crash)
- [ ] Display IDs are read-only in all UIs — no input field

### Constraints
- [ ] `displayId` is never returned from update/patch endpoints (immutable — cannot be patched)
- [ ] `displayId` is included in all `findAll` / `findOne` responses
- [ ] Duplicate `displayId` at DB level is rejected by `@unique` constraint

---

## 5. Scope boundaries

**In scope:**
- 9 models: Booking, Store, Candidate, Lab, User(client), Panel, TestMaster, Zone, City
- `IdSequence` counter table (one row per prefix)
- Shared `IdSequenceService` utility
- Backend: `displayId` on schema, generation in each service's `create()`
- Frontend: display `displayId` in listing tables and detail cards

**Explicitly out of scope:**
- Searching/filtering by `displayId` on the backend (future — add once IDs are populated)
- Bulk CSV import generating `displayId` — backfill handles it
- Changing the internal `id` (cuid) — never touched
- Report/PDF export — deferred
- `displayId` on join/audit tables (PanelTest, BookingScheduleChange, ClientPanelPricing, etc.)
- User (ADMIN role) — only USER (client) gets a displayId

---

## 6. New data model

### New model: `IdSequence`
```prisma
model IdSequence {
  prefix  String @id   // e.g. "B", "CL", "T"
  nextVal Int    @default(1)

  @@map("id_sequences")
}
```

### New field on each of 9 models:
```prisma
displayId  String?  @unique
```

Added to: `Booking`, `Store`, `Candidate`, `Lab`, `User`, `Panel`, `TestMaster`, `Zone`, `City`.

Migration is **additive** — `String?` so existing rows get `null` (no data loss).

### ID generation logic (in service, inside transaction):
```ts
// Atomic: increment nextVal and return it
const seq = await tx.idSequence.update({
  where: { prefix },
  data: { nextVal: { increment: 1 } },
  select: { nextVal: true },
});
const displayId = `${prefix}${String(seq.nextVal).padStart(3, '0')}`;
```

---

## 7. API changes

No new endpoints. Existing response shapes gain one field:

```json
// Before:
{ "id": "cld_abc", "name": "...", ... }

// After:
{ "id": "cld_abc", "displayId": "B001", "name": "...", ... }
```

`displayId` appears in all `findAll` / `findOne` / `create` responses for the 9 models.

---

## 8. Edge cases and error states

- **Concurrent creates**: `idSequence.update({ data: { nextVal: { increment: 1 } } })` inside `$transaction` is atomic at DB level — safe under concurrency
- **Counter row missing** (prefix not seeded): service throws `InternalServerErrorException`; fix by re-running seed
- **displayId collision** (shouldn't happen with atomic counter, but DB `@unique` is the safety net): Prisma throws `P2002` unique constraint error
- **Existing records with `displayId: null`**: frontend renders `—`; backfill script assigns IDs sequentially by `createdAt` order
- **Number overflow**: `padStart(3, '0')` format grows naturally — B999 → B1000 (4 digits)

---

## 9. Non-functional requirements

- Counter increment is inside `$transaction` — no extra DB round-trips outside it
- `displayId` index on each model (Prisma `@unique` creates a DB index automatically)
- Immutability enforced at service layer — no `update` call ever touches `displayId`
- `displayId` never exposed in error messages or logs

---

## 10. Conformance checklist

- [ ] `id_sequences` table seeded with 9 prefix rows
- [ ] `displayId String? @unique` added to all 9 models in schema
- [ ] Migration applied without data loss
- [ ] Each of 9 `create()` service methods generates `displayId` atomically
- [ ] All `findAll` / `findOne` responses include `displayId`
- [ ] Listing pages: `displayId` shown as first column
- [ ] Detail pages: `displayId` shown in header
- [ ] Null `displayId` renders as `—` (no crash)
- [ ] Backend `tsc --noEmit` clean
- [ ] Frontend `tsc -b --noEmit` clean
