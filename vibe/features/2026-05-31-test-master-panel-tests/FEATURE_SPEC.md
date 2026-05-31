# FEATURE_SPEC — Test Master & Panel–Test Linking
> Created: 2026-05-31 | Folder: vibe/features/2026-05-31-test-master-panel-tests/

---

## 1. Feature overview

Introduce a **Test Master** module that stores individual diagnostic test types
(e.g. "Complete Blood Count", "Blood Sugar Level") as first-class records with
`id`, `name`, and `status`.  Admin can manage these tests from a dedicated page.
When creating a Panel, admin selects a Lab and then picks one or more Test Master
records (multi-select) instead of a Bundled Test.  The Bundled Test step is
commented out but not deleted, so it can be restored without risk.

---

## 2. User stories

| Who | Does what | Outcome |
|-----|-----------|---------|
| Admin | Opens `/admin/tests` | Sees list of all Test Master records with status |
| Admin | Creates a new test | Test appears in the master list with status ACTIVE |
| Admin | Deactivates a test | Test shows INACTIVE; removed from multi-select in panel creation |
| Admin | Creates a panel (from Client Detail) | Picks Lab → multi-select from active Test Master tests → saves panel with linked tests |
| Admin | Views Panels page | "Tests included" column shows selected TestMaster names instead of BundledTest |

---

## 3. Acceptance criteria

### Test Master CRUD
- [ ] `GET /test-masters` returns all non-deleted tests (ADMIN only)
- [ ] `POST /test-masters` creates a test with `name` (unique, required) + `status` ACTIVE default (ADMIN only)
- [ ] `PATCH /test-masters/:id` can update name or status (ADMIN only)
- [ ] `DELETE /test-masters/:id` soft-deletes (sets `deletedAt`, `deletedBy`) (ADMIN only)
- [ ] Test Master page at `/admin/tests` — list, add, toggle active, delete; matches existing Lab/Zone page pattern
- [ ] Test Master is a global master (no Lab FK — lab-independence is intentional)

### Panel creation via Test Master
- [ ] `CreatePanelDto` accepts `testMasterIds: string[]` (1+), `bundledTestId` is removed (field deleted from DTO — NOT just optional)
- [ ] `Panel.bundledTestId` made nullable in schema (migration); existing panel rows keep their current value
- [ ] `PanelService.create()` validates each `testMasterId` exists and is not deleted; creates `PanelTest` join rows in the same transaction
- [ ] `PanelService.findAll()` / `findOne()` include `panelTests → testMaster { id, name, status }` in response
- [ ] `AddPanelForm` (in `ClientDetailPage`) drops BundledTest combobox (commented out), adds multi-select for Test Master tests
- [ ] Multi-select shows only ACTIVE tests; label is test name
- [ ] At least one test must be selected (frontend + backend validation)
- [ ] Panels table ("Tests included" column) renders linked TestMaster names instead of BundledTest chip list

### Existing flow preserved
- [ ] `GET /lab-bundled-tests`, `POST /lab-bundled-tests`, etc. — untouched and still working
- [ ] `LabBundledTest` model — no schema changes
- [ ] Existing panels that have a `bundledTestId` still display correctly (nullable migration is backward compatible)
- [ ] All other modules (booking, candidates, reports, users, auth) — not touched

---

## 4. Scope boundaries

**In scope:**
- TestMaster CRUD (backend module + frontend page)
- `PanelTest` join table (schema + migration)
- Making `Panel.bundledTestId` nullable (additive schema migration)
- Updating `CreatePanelDto` to use `testMasterIds`
- Updating `PanelService.create/findAll/findOne` to use join table
- Updating `AddPanelForm` in `ClientDetailPage` (comment out BundledTest combobox, add Test Master multi-select)
- Updating `PanelsPage` to show TestMaster names

**Explicitly out of scope / deferred:**
- Removing BundledTest module — kept intact (just hidden from panel creation UI)
- Booking or report changes — not touched
- Assigning TestMaster tests to Bookings directly — future feature
- Test Master having a Lab FK — intentionally global (no lab constraint)
- Bulk import of Test Master records — future

---

## 5. Integration points

| Layer | File | What changes |
|-------|------|-------------|
| Schema | `prisma/schema.prisma` | + `TestMaster` model, + `PanelTest` model, `Panel.bundledTestId String?` (nullable), + `Panel.panelTests PanelTest[]` |
| Migration | `prisma/migrations/` | New migration for the above |
| Backend module | `src/modules/test-master/` (new) | controller, service, module, 3 DTOs |
| app.module | `src/app.module.ts` | Import TestMasterModule |
| Panel DTO | `src/modules/panel/dto/create-panel.dto.ts` | Replace `bundledTestId` with `testMasterIds: string[]` |
| Panel service | `src/modules/panel/panel.service.ts` | `create()` uses PanelTest join; `findAll/findOne` include panelTests |
| Frontend types | `src/types/panel.types.ts` | Update `Panel`, `CreatePanelInput`; add `TestMaster` |
| Frontend types | `src/types/testMaster.types.ts` (new) | `TestMaster`, `CreateTestMasterInput` |
| Frontend service | `src/services/testMaster.service.ts` (new) | CRUD calls |
| Frontend hook | `src/features/test-master/hooks/useTestMaster.ts` (new) | TanStack Query wrappers |
| Frontend page | `src/pages/admin/TestMasterPage.tsx` (new) | List + add + toggle + delete |
| Frontend page | `src/pages/admin/ClientDetailPage.tsx` | `AddPanelForm` — comment out BundledTest combobox, add multi-select for TestMaster |
| Frontend page | `src/pages/admin/PanelsPage.tsx` | "Tests included" renders TestMaster names from `panelTests` |
| Router | `src/routes/AppRouter.tsx` | Add `/admin/tests` route |
| Sidebar | `src/components/layout/Sidebar.tsx` | Add "Tests" nav item (ADMIN, after Labs) |
| Query keys | `src/api/queryKeys.ts` | Add `testMasters` keys |

---

## 6. New data model

```prisma
enum TestMasterStatus {
  ACTIVE
  INACTIVE
}

model TestMaster {
  id          String           @id @default(cuid())   // @id implies PK + unique — no separate @unique needed
  name        String           @unique                 // e.g. "Complete Blood Count"
  description String?          @db.VarChar(255)        // optional, max 255 chars
  status      TestMasterStatus @default(ACTIVE)
  createdAt   DateTime         @default(now())
  createdBy   String?
  deletedAt   DateTime?
  deletedBy   String?

  panelTests PanelTest[]

  @@map("test_masters")
}

model PanelTest {
  id           String     @id @default(cuid())
  panelId      String
  testMasterId String

  panel      Panel      @relation(fields: [panelId],      references: [id])
  testMaster TestMaster @relation(fields: [testMasterId], references: [id])

  @@unique([panelId, testMasterId])
  @@map("panel_tests")
}
```

**Changes to existing `Panel` model:**
```prisma
// Before:
bundledTestId  String
bundledTest    LabBundledTest @relation(...)

// After:
bundledTestId  String?                  ← nullable (additive, backward compatible)
bundledTest    LabBundledTest? @relation(...)
panelTests     PanelTest[]              ← new relation
```

Migration is **additive only**: nullable column change + two new tables. No existing data is altered.

---

## 7. New API endpoints

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/api/v1/test-masters` | ADMIN | List all active (non-deleted) tests |
| POST | `/api/v1/test-masters` | ADMIN | Create a test |
| PATCH | `/api/v1/test-masters/:id` | ADMIN | Update name or status |
| DELETE | `/api/v1/test-masters/:id` | ADMIN | Soft-delete |

**`POST /api/v1/panels` body change:**
```json
// Before:  { labId, bundledTestId, name, mrp, costToVendor, timing?, labContact? }
// After:   { labId, testMasterIds: ["id1","id2"], name, mrp, costToVendor, timing?, labContact? }
```

**`GET /api/v1/panels` response — new field:**
```json
{
  "panelTests": [
    { "id": "...", "testMasterId": "...", "testMaster": { "id": "...", "name": "Complete Blood Count", "status": "ACTIVE" } }
  ]
}
```

---

## 8. Edge cases and error states

- Creating a panel with `testMasterIds: []` → `400 Bad Request` ("At least one test is required")
- `testMasterIds` containing an ID that doesn't exist or is deleted → `404 Not Found` ("Test not found: <id>")
- Duplicate test name in TestMaster → `409 Conflict`
- Soft-deleting a TestMaster test that is used in existing panels → allowed (the `PanelTest` rows remain; the test is just INACTIVE)
- Panel form: submit with no test selected → form validation error "Select at least one test"

---

## 9. Non-functional requirements

- No breaking changes to booking, candidate, or report modules
- All new routes guarded `@Roles(Role.ADMIN)` + `@UseGuards(JwtAuthGuard, RolesGuard)`
- Soft delete on TestMaster (same `deletedAt/deletedBy` pattern as every other master entity)
- `PanelTest` rows are hard-deleted when a Panel is soft-deleted (or left as orphans — acceptable since Panel is soft-deleted not removed)
- TestMaster `name` is `@unique` to prevent duplicates at DB level

---

## 10. Conformance checklist

- [ ] `GET /test-masters` returns list (ADMIN only, 401/403 otherwise)
- [ ] `POST /test-masters` creates with name+status; 409 on duplicate name
- [ ] `PATCH/DELETE /test-masters/:id` work; soft-delete sets deletedAt
- [ ] `POST /panels` with `testMasterIds` creates PanelTest rows; validates each ID
- [ ] `GET /panels` includes `panelTests.testMaster` in response
- [ ] `/admin/tests` page: list, add, activate/deactivate, delete
- [ ] `AddPanelForm` multi-select loads from `GET /test-masters`, BundledTest combobox commented out
- [ ] `PanelsPage` "Tests included" column renders from `panelTests`
- [ ] Existing panels with `bundledTestId` still render without error
- [ ] No regressions in booking, candidate, or auth flows
