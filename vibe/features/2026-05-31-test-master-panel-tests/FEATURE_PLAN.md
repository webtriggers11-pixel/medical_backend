# FEATURE_PLAN — Test Master & Panel–Test Linking
> Created: 2026-05-31

---

## 1. Impact map

### New files
| File | Purpose |
|------|---------|
| `src/modules/test-master/test-master.module.ts` | NestJS module |
| `src/modules/test-master/test-master.controller.ts` | CRUD routes |
| `src/modules/test-master/test-master.service.ts` | Business logic |
| `src/modules/test-master/dto/create-test-master.dto.ts` | POST body |
| `src/modules/test-master/dto/update-test-master.dto.ts` | PATCH body |
| `src/types/testMaster.types.ts` (frontend) | TS interfaces |
| `src/services/testMaster.service.ts` (frontend) | API calls |
| `src/features/test-master/hooks/useTestMaster.ts` (frontend) | TanStack Query |
| `src/pages/admin/TestMasterPage.tsx` (frontend) | CRUD page |

### Modified files
| File | Change |
|------|--------|
| `prisma/schema.prisma` | + TestMaster model, + PanelTest model, Panel.bundledTestId → nullable, + Panel.panelTests relation |
| `prisma/migrations/<timestamp>_test_master_panel_tests/` | Generated migration |
| `src/app.module.ts` | Import TestMasterModule |
| `src/modules/panel/dto/create-panel.dto.ts` | Replace bundledTestId with testMasterIds: string[] |
| `src/modules/panel/panel.service.ts` | create() → PanelTest join rows; findAll/findOne → include panelTests |
| `src/types/panel.types.ts` (frontend) | Update Panel interface, CreatePanelInput |
| `src/api/queryKeys.ts` (frontend) | + testMasters keys |
| `src/routes/AppRouter.tsx` (frontend) | + /admin/tests route |
| `src/components/layout/Sidebar.tsx` (frontend) | + Tests nav item |
| `src/pages/admin/ClientDetailPage.tsx` (frontend) | AddPanelForm: comment out BundledTest, add TestMaster multi-select |
| `src/pages/admin/PanelsPage.tsx` (frontend) | "Tests included" reads panelTests |

### Files explicitly NOT touched
- `src/modules/lab/bundled-test.controller.ts`
- `src/modules/lab/bundled-test.service.ts`
- `src/modules/lab/lab.controller.ts` / `lab.service.ts`
- `src/modules/booking/` — any file
- `src/modules/candidates/` — any file
- `src/modules/report/` — any file
- `src/modules/auth/` — any file
- `src/features/auth/` — any file
- `src/modules/panel/panel.controller.ts` — no route changes needed
- `src/modules/panel/dto/update-panel.dto.ts` — no change (update doesn't touch testMasterIds)

---

## 2. DB migration plan

### Step A — add TestMaster enum + model + PanelTest model

```sql
CREATE TYPE "TestMasterStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "test_masters" (
  "id"        TEXT NOT NULL DEFAULT '',
  "name"      TEXT NOT NULL UNIQUE,
  "status"    "TestMasterStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  "deletedAt" TIMESTAMP(3),
  "deletedBy" TEXT,
  CONSTRAINT "test_masters_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "panel_tests" (
  "id"           TEXT NOT NULL,
  "panelId"      TEXT NOT NULL,
  "testMasterId" TEXT NOT NULL,
  CONSTRAINT "panel_tests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "panel_tests_panelId_testMasterId_key" UNIQUE ("panelId", "testMasterId")
);

ALTER TABLE "panel_tests"
  ADD CONSTRAINT "panel_tests_panelId_fkey"
    FOREIGN KEY ("panelId") REFERENCES "panels"("id"),
  ADD CONSTRAINT "panel_tests_testMasterId_fkey"
    FOREIGN KEY ("testMasterId") REFERENCES "test_masters"("id");
```

### Step B — make Panel.bundledTestId nullable

```sql
ALTER TABLE "panels" ALTER COLUMN "bundledTestId" DROP NOT NULL;
```

This is backward-compatible — existing rows keep their value; it just allows NULL going forward.

**Run:** `npx prisma migrate dev --name test_master_panel_tests`

---

## 3. Backend changes

### TestMasterModule (`src/modules/test-master/`)

**Controller** — all routes `@Roles(Role.ADMIN)`:
```
GET  /test-masters              → testMasterService.findAll()
POST /test-masters              → testMasterService.create(dto)
PATCH /test-masters/:id         → testMasterService.update(id, dto)
DELETE /test-masters/:id        → testMasterService.softDelete(id, userId)
```

**Service patterns** (mirror Zone/City module exactly):
- `findAll()`: `where: { deletedAt: null }`, ordered by `createdAt desc`
- `create()`: check for duplicate name → `ConflictException`; create with `createdBy`
- `update()`: find or throw → `prisma.testMaster.update()`
- `softDelete()`: find or throw → set `deletedAt, deletedBy`

**DTOs:**
```ts
// create-test-master.dto.ts
class CreateTestMasterDto {
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsOptional() @MaxLength(255) description?: string;
  @IsEnum(TestMasterStatus) @IsOptional() status?: TestMasterStatus;
}
// update-test-master.dto.ts — all fields optional
class UpdateTestMasterDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() @MaxLength(255) description?: string;
  @IsEnum(TestMasterStatus) @IsOptional() status?: TestMasterStatus;
}
```

### Panel service changes

**`create(dto, userId)`:**
```ts
// Comment out:
// const bundledTest = await this.prisma.labBundledTest.findFirst(...)
// if (!bundledTest) throw new NotFoundException(...)

// Add:
// Validate each testMasterId
for (const tmId of dto.testMasterIds) {
  const test = await this.prisma.testMaster.findFirst({ where: { id: tmId, deletedAt: null } });
  if (!test) throw new NotFoundException(`Test not found: ${tmId}`);
}

// Create panel + PanelTest rows in transaction
return this.prisma.$transaction(async (tx) => {
  const panel = await tx.panel.create({ data: { labId, name, mrp, costToVendor, ... } });
  await tx.panelTest.createMany({
    data: dto.testMasterIds.map((testMasterId) => ({ panelId: panel.id, testMasterId })),
  });
  return tx.panel.findUnique({ where: { id: panel.id }, include: PANEL_INCLUDE });
});
```

**`findAll()` / `findOne()` include:**
```ts
panelTests: {
  where: {},  // no soft delete on join rows
  include: { testMaster: { select: { id: true, name: true, status: true } } },
},
// Keep bundledTest include for backward compat with existing rows:
bundledTest: { select: { id: true, name: true, testsIncluded: true } },
```

**`CreatePanelDto` change:**
```ts
// Remove:   @IsString() bundledTestId: string;
// Add:
@ApiProperty({ type: [String] })
@IsArray()
@IsString({ each: true })
@ArrayMinSize(1)
testMasterIds: string[];
```

---

## 4. Frontend changes

### queryKeys.ts — add:
```ts
testMasters: {
  all: ['test-masters'] as const,
  byId: (id: string) => ['test-masters', id] as const,
}
```

### testMaster.types.ts (new):
```ts
export type TestMasterStatus = 'ACTIVE' | 'INACTIVE';
export interface TestMaster { id: string; name: string; status: TestMasterStatus; createdAt: string; }
export interface CreateTestMasterInput { name: string; status?: TestMasterStatus; }
export interface UpdateTestMasterInput { name?: string; status?: TestMasterStatus; }
```

### testMaster.service.ts (new):
Standard CRUD service — `getAll()`, `create()`, `update()`, `remove()` → `/test-masters`.

### useTestMaster.ts (new):
```ts
export const useTestMasters = () => useQuery(...)       // GET /test-masters
export const useCreateTestMaster = () => useMutation(...)
export const useUpdateTestMaster = () => useMutation(...)
export const useDeleteTestMaster = () => useMutation(...)
```

### TestMasterPage.tsx (new) — `/admin/tests`:
Mirror `ZonesPage` pattern exactly:
- Card table: Name | Status | Created | Actions
- "Add test" button → inline modal (same as `AddClientModal` pattern)
- Row actions: toggle status (PATCH), Delete (ConfirmDialog + soft-delete)
- Search filter
- `EmptyState` when no tests

### panel.types.ts updates:
```ts
// Add:
export interface PanelTest {
  id: string; panelId: string; testMasterId: string;
  testMaster?: { id: string; name: string; status: string };
}
// Update Panel:
bundledTestId: string | null;   // was: string
bundledTest?: { ... } | null;
panelTests?: PanelTest[];       // new
// Update CreatePanelInput:
testMasterIds: string[];        // replaces bundledTestId
```

### ClientDetailPage.tsx — AddPanelForm:
```tsx
// COMMENT OUT (do not delete):
{/* BUNDLED TEST — temporarily commented out in favour of Test Master
<Controller name="bundledTestId" ... render={...} />
*/}

// ADD: multi-select for Test Master
// Use an existing Combobox in multi-select mode, or a simple checkbox list
// Since Combobox doesn't currently support multiSelect, implement as:
// - a searchable dropdown that shows checkboxes per item
// - or store selectedTests: string[] in useState, show selected as chips below
// Recommended: useState checkboxes in a scrollable dropdown div (no new component needed)
```

Panel name auto-fill: remove the "auto-fill from bundled test" logic; admin types the panel name manually.

### PanelsPage.tsx:
```tsx
// Column "Bundled test" → comment out
{/* <td>...p.bundledTest?.name...</td> */}

// Column "Tests included" — change from bundledTest.testsIncluded to panelTests:
<td>
  {p.panelTests?.length
    ? p.panelTests.map(pt => <Badge key={pt.id}>{pt.testMaster?.name}</Badge>)
    : '—'}
</td>
```

### AppRouter.tsx:
```tsx
<Route path="/admin/tests" element={<TestMasterPage />} />
```
(inside the existing `<RoleRoute allowedRoles={ROLE_GROUPS.adminOnly}>` block)

### Sidebar.tsx:
Add nav item after "Labs":
```ts
{ label: 'Tests', path: '/admin/tests', roles: ['ADMIN'], icon: <BeakerIcon /> }
```

---

## 5. Conventions to follow

- Every controller: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(Role.ADMIN)` + `@ApiBearerAuth()`
- All responses wrapped by `TransformInterceptor` automatically — no action needed
- Soft deletes: set `deletedAt: new Date(), deletedBy: userId` — never hard delete
- DTOs: `@ApiProperty` on all fields, `@IsOptional()` on update DTOs
- Throw `NotFoundException` / `ConflictException` from `@nestjs/common`
- Frontend: `res.data.data` unwrap, `getApiErrorMessage(err)` for catch blocks
- Form pattern: react-hook-form + try/catch + `setApiError()`
- TanStack Query: invalidate `queryKeys.panels.all` and `queryKeys.testMasters.all` on mutations

---

## 6. Rollback plan

1. Revert `prisma/schema.prisma` changes (remove TestMaster, PanelTest, restore bundledTestId non-null)
2. Run `prisma migrate dev --name revert_test_master` (drops the two new tables; `bundledTestId NOT NULL` restored)
3. Delete `src/modules/test-master/`
4. Revert `app.module.ts`, `create-panel.dto.ts`, `panel.service.ts`
5. Revert frontend: types, service, hooks, page, AppRouter, Sidebar, ClientDetailPage, PanelsPage
6. Existing panels retain their `bundledTestId` values — no data loss

---

## 7. Testing strategy

- Backend: `panel.service.spec.ts` — test `create()` with `testMasterIds` (valid, empty array, non-existent ID)
- Backend: `test-master.service.spec.ts` — create, duplicate name, soft-delete
- Frontend: TypeScript compile (`tsc -b --noEmit`) must pass after every task
- Manual E2E: Create test in TestMaster → create panel using those tests → verify PanelsPage shows names

---

## 8. CODEBASE.md sections to update after completion

- Section 5 (Backend module structure): add `test-master/`
- Section 7 (API endpoints): add TestMaster endpoints, note Panel create body change
- Section 8 (Frontend routes): add `/admin/tests`
- Section 9 (Key file paths): add new files
