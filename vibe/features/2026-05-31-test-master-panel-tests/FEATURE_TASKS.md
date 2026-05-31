# FEATURE_TASKS — Test Master & Panel–Test Linking
> Created: 2026-05-31

> **Estimated effort:** 10 tasks — S: 4 (<2hrs), M: 5 (2-4hrs), L: 1 (4+hrs) — approx. 20 hours total

---

### TM-01 · Prisma schema + migration
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#6-new-data-model
- **Dependencies**: None
- **Touches**: `prisma/schema.prisma`

**What to do**:
1. Add `TestMasterStatus` enum (`ACTIVE`, `INACTIVE`) to schema.prisma after existing enums.
2. Add `TestMaster` model. Fields:
   - `id String @id @default(cuid())` — `@id` is PK + implicitly unique; no separate `@unique` needed
   - `name String @unique` — test name must be unique
   - `description String? @db.VarChar(255)` — optional, DB-enforced 255-char cap
   - `status TestMasterStatus @default(ACTIVE)`
   - `createdAt, createdBy?, deletedAt?, deletedBy?`
   - relation `panelTests PanelTest[]`, `@@map("test_masters")`
3. Add `PanelTest` model (fields: `id, panelId, testMasterId`, relations to Panel and TestMaster, `@@unique([panelId, testMasterId])`, `@@map("panel_tests")`).
4. On `Panel` model: change `bundledTestId String` → `bundledTestId String?`, change `bundledTest LabBundledTest @relation(...)` → `bundledTest LabBundledTest? @relation(...)`, add `panelTests PanelTest[]`.
5. Run `npx prisma migrate dev --name test_master_panel_tests` from `medical_backend/`.
6. Run `npx prisma generate`.

**Acceptance criteria**:
- [ ] `prisma migrate dev` completes without error
- [ ] `test_masters` and `panel_tests` tables exist in DB
- [ ] `panels.bundledTestId` allows NULL (verify with `\d panels` or pgAdmin)
- [ ] `npx prisma generate` succeeds — Prisma client reflects new models

**Self-verify**: Check schema compiles: `npx prisma validate`.
**Test requirement**: Migration success + `prisma validate` clean.
**⚠️ Boundaries**: Never hard-delete data; only adding columns/tables. Do NOT remove `bundledTestId` column — only make nullable.
**CODEBASE.md update?**: Yes — Section 4 (data model): add TestMaster and PanelTest.
**Architecture compliance**: Soft-delete pattern (deletedAt/deletedBy). Enum-per-model status pattern.

**Decisions**: None yet.

---

### TM-02 · TestMaster backend module
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#7-new-api-endpoints
- **Dependencies**: TM-01
- **Touches**:
  - `src/modules/test-master/test-master.module.ts` (new)
  - `src/modules/test-master/test-master.controller.ts` (new)
  - `src/modules/test-master/test-master.service.ts` (new)
  - `src/modules/test-master/dto/create-test-master.dto.ts` (new)
  - `src/modules/test-master/dto/update-test-master.dto.ts` (new)
  - `src/app.module.ts`

**What to do**:
Mirror the `ZoneModule` pattern exactly.
1. `create-test-master.dto.ts`:
   - `@IsString() @IsNotEmpty() name: string`
   - `@IsString() @IsOptional() @MaxLength(255) description?: string` — import `MaxLength` from class-validator; `@ApiPropertyOptional({ maxLength: 255 })`
   - `@IsEnum(TestMasterStatus) @IsOptional() status?: TestMasterStatus`
2. `update-test-master.dto.ts`: same fields as create but all `@IsOptional()` — `name?`, `description? @MaxLength(255)`, `status?`.
3. `test-master.service.ts`:
   - `findAll()`: `prisma.testMaster.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' } })`
   - `create(dto, userId)`: check name uniqueness → ConflictException; then create with `createdBy: userId`
   - `update(id, dto)`: find or throw (NotFoundException); update
   - `softDelete(id, userId)`: find or throw; set `deletedAt: new Date(), deletedBy: userId`
4. `test-master.controller.ts`: `@ApiTags('Test Masters') @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Controller('test-masters')`. All routes `@Roles(Role.ADMIN)`.
5. `test-master.module.ts`: imports PrismaModule.
6. `app.module.ts`: import and register `TestMasterModule`.

**Acceptance criteria**:
- [ ] `GET /api/v1/test-masters` returns `[]` initially (200, ADMIN auth)
- [ ] `POST /api/v1/test-masters` `{ "name": "Complete Blood Count" }` → creates record (201)
- [ ] `POST` duplicate name → 409
- [ ] `PATCH /api/v1/test-masters/:id` `{ "status": "INACTIVE" }` → updates status (200)
- [ ] `DELETE /api/v1/test-masters/:id` → soft-deletes; record no longer in GET list (200)
- [ ] Non-ADMIN request → 403

**Self-verify**: Test all 4 endpoints via Swagger or curl.
**Test requirement**: Smoke test each endpoint manually.
**⚠️ Boundaries**: Do NOT touch lab/panel/bundled-test modules.
**CODEBASE.md update?**: Yes — Section 5 (modules): add test-master/; Section 7 (endpoints): add 4 routes.
**Architecture compliance**: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(Role.ADMIN)`, soft-delete, ConflictException for duplicates.

**Decisions**: None yet.

---

### TM-03 · Panel service — wire PanelTest join on create
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria (Panel creation via Test Master)
- **Dependencies**: TM-01
- **Touches**:
  - `src/modules/panel/dto/create-panel.dto.ts`
  - `src/modules/panel/panel.service.ts`

**What to do**:
1. **`create-panel.dto.ts`**: Remove `bundledTestId: string`. Add:
   ```ts
   @ApiProperty({ type: [String], description: 'IDs from TestMaster' })
   @IsArray()
   @IsString({ each: true })
   @ArrayMinSize(1)
   testMasterIds: string[];
   ```
   Add `import { IsArray, ArrayMinSize } from 'class-validator'`.

2. **`panel.service.ts`** — `create()`:
   - Comment out the bundledTest validation block (do NOT delete):
     ```ts
     /* BUNDLED TEST — commented out, replaced by TestMaster
     const bundledTest = await this.prisma.labBundledTest.findFirst(...)
     if (!bundledTest) throw new NotFoundException(...)
     */
     ```
   - Validate each `testMasterId`:
     ```ts
     for (const tmId of dto.testMasterIds) {
       const test = await this.prisma.testMaster.findFirst({ where: { id: tmId, deletedAt: null } });
       if (!test) throw new NotFoundException(`Test not found: ${tmId}`);
     }
     ```
   - Wrap in `prisma.$transaction`:
     ```ts
     return this.prisma.$transaction(async (tx) => {
       const panel = await tx.panel.create({ data: { labId, name, mrp, costToVendor, timing, labContact, createdBy: userId } });
       if (dto.testMasterIds.length) {
         await tx.panelTest.createMany({
           data: dto.testMasterIds.map(testMasterId => ({ panelId: panel.id, testMasterId })),
         });
       }
       return tx.panel.findUnique({ where: { id: panel.id }, include: PANEL_INCLUDE });
     });
     ```
   - Add `panelTests: { include: { testMaster: { select: { id: true, name: true, status: true } } } }` to the `PANEL_INCLUDE` const (extract existing include object to a const if not already).

3. **`findAll()` and `findOne()`**: Add `panelTests` to the `include` block (same shape as above). Keep `bundledTest` include for backward compat with existing rows.

**Acceptance criteria**:
- [ ] `POST /panels` with `testMasterIds: ["<valid-id>"]` creates panel + PanelTest row
- [ ] `POST /panels` with `testMasterIds: []` → 400 (class-validator ArrayMinSize)
- [ ] `POST /panels` with non-existent testMasterId → 404
- [ ] `GET /panels` response includes `panelTests` array with `testMaster.name`
- [ ] Backend compiles without error (`npx tsc -p tsconfig.json --noEmit`)

**Self-verify**: `tsc --noEmit` clean. Test create via Swagger.
**Test requirement**: Compile check + manual create with testMasterIds.
**⚠️ Boundaries**: Comment out bundledTest logic — do NOT delete. Keep bundledTest in GET include for old data.
**CODEBASE.md update?**: No (schema already documented in TM-01).
**Architecture compliance**: `prisma.$transaction` for multi-table writes. Throw `NotFoundException` from `@nestjs/common`.

**Decisions**: None yet.

---

### TM-04 · Frontend — types, service, query keys, hooks
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#5-integration-points
- **Dependencies**: TM-02 (endpoints must exist)
- **Touches**:
  - `src/types/testMaster.types.ts` (new)
  - `src/services/testMaster.service.ts` (new)
  - `src/features/test-master/hooks/useTestMaster.ts` (new)
  - `src/api/queryKeys.ts`
  - `src/types/panel.types.ts`

**What to do**:
1. **`testMaster.types.ts`**:
   ```ts
   export type TestMasterStatus = 'ACTIVE' | 'INACTIVE';
   export interface TestMaster {
     id: string;           // PK — unique by definition
     name: string;         // unique
     description: string | null;   // max 255 chars, optional
     status: TestMasterStatus;
     createdAt: string;
   }
   export interface CreateTestMasterInput { name: string; description?: string; status?: TestMasterStatus; }
   export interface UpdateTestMasterInput { name?: string; description?: string; status?: TestMasterStatus; }
   ```
2. **`testMaster.service.ts`**: Standard CRUD — `getAll()`, `create()`, `update(id, input)`, `remove(id)` hitting `/test-masters`.
3. **`queryKeys.ts`**: Add `testMasters: { all: ['test-masters'] as const, byId: (id: string) => ['test-masters', id] as const }`.
4. **`useTestMaster.ts`**: `useTestMasters()` query + `useCreateTestMaster()`, `useUpdateTestMaster()`, `useDeleteTestMaster()` mutations (invalidate `queryKeys.testMasters.all` on success).
5. **`panel.types.ts`** — update:
   - Add `PanelTest` interface: `{ id: string; panelId: string; testMasterId: string; testMaster?: { id: string; name: string; status: string }; }`
   - `Panel.bundledTestId` → `string | null`
   - `Panel.bundledTest` → `{ ... } | null | undefined`
   - `Panel.panelTests?: PanelTest[]`
   - `CreatePanelInput.bundledTestId` → remove; add `testMasterIds: string[]`

**Acceptance criteria**:
- [ ] `npx tsc -b --noEmit` passes with zero errors
- [ ] `useTestMasters()` hook compiles and can be imported

**Self-verify**: TypeScript compile.
**Test requirement**: tsc clean.
**⚠️ Boundaries**: Do not change auth/candidate/report types.
**CODEBASE.md update?**: Yes — Section 9 (key file paths): add new frontend files.
**Architecture compliance**: `res.data.data` unwrap; TanStack Query invalidation pattern.

**Decisions**: None yet.

---

### TM-05 · Frontend — TestMasterPage (/admin/tests)
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#2-user-stories
- **Dependencies**: TM-04
- **Touches**:
  - `src/pages/admin/TestMasterPage.tsx` (new)
  - `src/routes/AppRouter.tsx`
  - `src/components/layout/Sidebar.tsx`

**What to do**:
1. **`TestMasterPage.tsx`**: Model on `ZonesPage.tsx`. Table columns: Name | Status | Created | Actions.
   - Header: "Tests" h1, "Master list of diagnostic test types", count.
   - "Add test" button → inline `Modal` with a form: one `Input` for name, optional status toggle. Same pattern as `AddClientModal` in `ClientsPage`.
   - Row actions: "Deactivate"/"Activate" (PATCH status toggle), "Delete" (ConfirmDialog → soft-delete).
   - Loading state: `SkeletonTable`. Empty state: `EmptyState`.
   - Search with `SearchInput` filtering by name.
   - `Pagination` via `usePagination`.

2. **`AppRouter.tsx`**: Inside the admin `RoleRoute` block:
   ```tsx
   import { TestMasterPage } from '../pages/admin/TestMasterPage';
   // ...
   <Route path="/admin/tests" element={<TestMasterPage />} />
   ```

3. **`Sidebar.tsx`**: Add after the Labs nav item:
   ```ts
   {
     label: 'Tests',
     path: '/admin/tests',
     roles: ['ADMIN'],
     icon: (<svg className="w-5 h-5" ...><path ... /></svg>)  // use beaker/flask icon
   }
   ```
   Use this Heroicons path for the beaker icon:
   `M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5`

**Acceptance criteria**:
- [ ] `/admin/tests` renders with the Tests list (or empty state)
- [ ] Add test modal: name required, submits, closes, list refreshes
- [ ] Activate/Deactivate toggles status correctly
- [ ] Delete shows ConfirmDialog, soft-deletes, list refreshes
- [ ] "Tests" appears in sidebar under Labs
- [ ] `tsc -b --noEmit` passes

**Self-verify**: Visually test all four interactions.
**Test requirement**: tsc clean + manual visual check.
**⚠️ Boundaries**: Do not touch any other sidebar item positions.
**CODEBASE.md update?**: Yes — Section 8 (frontend routes): add /admin/tests.
**Architecture compliance**: `Modal` + `ConfirmDialog` pattern; `usePagination`; `EmptyState`.

**Decisions**: None yet.

---

### TM-06 · Frontend — AddPanelForm: swap BundledTest for TestMaster multi-select
- **Status**: `[ ]`
- **Size**: L
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria (Panel creation)
- **Dependencies**: TM-04, TM-05
- **Touches**: `src/pages/admin/ClientDetailPage.tsx`

**What to do**:
In `ClientDetailPage.tsx`, the `AddPanelForm` component:

1. **Comment out** the BundledTest `<Controller>` block (keep in code, wrapped in `{/* BUNDLED TEST — commented out ... */}`):
   ```tsx
   {/* BUNDLED TEST — temporarily replaced by Test Master multi-select
   <Controller name="bundledTestId" control={control} rules={{ required: 'Required' }}
     render={({ field }) => (
       <Combobox label="Bundled test" ... />
     )}
   />
   */}
   ```

2. **Comment out** the auto-fill logic that reads bundledTest:
   ```tsx
   /* const selectedTest = bundledTests?.find(...)  — commented out */
   /* const handleTestChange = ...  — commented out */
   /* {selectedTest && selectedTest.testsIncluded.length > 0 && (...)} */
   ```

3. **Remove** `useBundledTests` import and `testsLoading` / `bundledTests` / `testOptions` — or comment out since we may restore later. Comment out rather than delete.

4. **Add** Test Master multi-select:
   - Add `import { useTestMasters } from '../../features/test-master/hooks/useTestMaster'`
   - In form values interface: remove `bundledTestId: string`, add `testMasterIds: string[]`
   - In the form: add `selectedTests: string[]` local state (outside RHF since it's a controlled multi-select)
   - Render a scrollable checkbox list (or use a multi-select approach):
     ```tsx
     // Render after Lab combobox:
     <div>
       <label className="block text-sm font-medium text-slate-700 mb-1.5">
         Tests <span className="text-red-500">*</span>
       </label>
       <div className="border border-border rounded-xl max-h-48 overflow-y-auto p-2 space-y-1">
         {activeTests.map(test => (
           <label key={test.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-sm">
             <input
               type="checkbox"
               checked={selectedTests.includes(test.id)}
               onChange={() => toggleTest(test.id)}
               className="rounded"
             />
             {test.name}
           </label>
         ))}
       </div>
       {selectedTests.length === 0 && submitted && (
         <p className="text-xs text-danger font-medium">Select at least one test</p>
       )}
       {selectedTests.length > 0 && (
         <div className="flex flex-wrap gap-1 mt-1.5">
           {selectedTests.map(id => {
             const t = activeTests.find(t => t.id === id);
             return t ? <Badge key={id} size="sm">{t.name}</Badge> : null;
           })}
         </div>
       )}
     </div>
     ```
   - `activeTests` = `testMasters?.filter(t => t.status === 'ACTIVE')` from `useTestMasters()`
   - `toggleTest(id)`: toggle id in selectedTests state
   - Frontend validation: if `selectedTests.length === 0` on submit → set error, do not call API

5. **Update `onSubmit`**: Pass `testMasterIds: selectedTests` in the panelService.create() call (instead of `bundledTestId`).

6. **Panel name**: Remove auto-fill logic; admin types it manually. Remove `setValue('name', test.name)` call.

**Acceptance criteria**:
- [ ] BundledTest combobox is gone from the form (commented, not deleted)
- [ ] Test Master checkbox list shows only ACTIVE tests from `/test-masters`
- [ ] Selecting tests shows chips below the list
- [ ] Submit with 0 tests → inline validation error, no API call
- [ ] Submit with tests → panel created, modal closes, panel list refreshes
- [ ] `tsc -b --noEmit` passes

**Self-verify**: Create a panel end-to-end in the UI.
**Test requirement**: tsc clean + manual E2E.
**⚠️ Boundaries**: Comment out bundledTest code — do NOT delete. Do not change EditPricingForm or PanelsTab.
**CODEBASE.md update?**: No.
**Architecture compliance**: `try/catch` + `setApiError(getApiErrorMessage(err))`.

**Decisions**: None yet.

---

### TM-07 · Frontend — PanelsPage: show TestMaster tests in table
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#2-user-stories
- **Dependencies**: TM-03, TM-04
- **Touches**: `src/pages/admin/PanelsPage.tsx`

**What to do**:
1. Comment out (do not delete) the "Bundled test" column header and cell:
   ```tsx
   {/* BUNDLED TEST — commented out
   <th ...>Bundled test</th>
   ...
   <td ...>{p.bundledTest?.name ?? '—'}</td>
   */}
   ```
2. Update the "Tests included" column to use `panelTests`:
   ```tsx
   <td className="px-5 py-4">
     {p.panelTests?.length ? (
       <div className="flex flex-wrap items-center gap-1 max-w-[220px]">
         {p.panelTests.slice(0, 4).map((pt) => (
           <Badge key={pt.id} size="sm" variant="default">{pt.testMaster?.name ?? '—'}</Badge>
         ))}
         {p.panelTests.length > 4 && (
           <span className="text-xs text-slate-400" title={p.panelTests.map(pt => pt.testMaster?.name).join(', ')}>
             +{p.panelTests.length - 4}
           </span>
         )}
       </div>
     ) : (p.bundledTest?.testsIncluded?.length ? (
       // Fallback: show old bundledTest data for existing panels
       <div className="flex flex-wrap gap-1 max-w-[220px]">
         {p.bundledTest.testsIncluded.slice(0,4).map(t => <Badge key={t} size="sm">{t}</Badge>)}
       </div>
     ) : '—')}
   </td>
   ```
   This fallback renders old `bundledTest.testsIncluded` data for existing panels that predate this feature.

3. Update the search filter to also search `panelTests` names:
   ```ts
   const filtered = panels?.filter((p) => {
     const q = search.toLowerCase();
     const testNames = p.panelTests?.map(pt => pt.testMaster?.name ?? '').join(' ') ?? '';
     return p.name.toLowerCase().includes(q) ||
       (p.lab?.name ?? '').toLowerCase().includes(q) ||
       (p.bundledTest?.name ?? '').toLowerCase().includes(q) ||   // keep for old data
       testNames.toLowerCase().includes(q);
   });
   ```

**Acceptance criteria**:
- [ ] Panels with `panelTests` show test names as chips
- [ ] Panels with only `bundledTest` (old data) still show the fallback chip list
- [ ] Search works across both test name sources
- [ ] `tsc -b --noEmit` passes

**Self-verify**: Open PanelsPage with both old and new panels visible.
**Test requirement**: tsc clean.
**⚠️ Boundaries**: Fallback for old data is mandatory — do not remove bundledTest display.
**CODEBASE.md update?**: No.
**Architecture compliance**: No new components needed.

**Decisions**: None yet.

---

### TM-08 · Integration smoke test
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#10-conformance-checklist
- **Dependencies**: TM-01 through TM-07
- **Touches**: No code — verification only

**What to do**:
Run through the full E2E scenario:
1. Go to `/admin/tests` → create "Complete Blood Count" → status ACTIVE.
2. Create "Blood Sugar Level" → ACTIVE.
3. Go to a client detail page → Add panel → Lab dropdown works, Test Master checkbox list shows both tests → select both → fill name/mrp/vendor → Create & assign panel.
4. Panel appears in `/admin/panels` with both test names as chips.
5. Go to `/admin/tests` → deactivate "Blood Sugar Level" → go back to Add Panel form → only "Complete Blood Count" shows.
6. Try to create a panel with 0 tests selected → validation error shows, no API call.
7. Confirm existing panels (if any) still display bundledTest data correctly.
8. Run `npx tsc -b --noEmit` → 0 errors.
9. Run `npx tsc -p tsconfig.json --noEmit` (backend) → 0 errors.

**Acceptance criteria**:
- [ ] All steps above pass
- [ ] No console errors in browser
- [ ] No regressions in Booking Requests, Candidates, Reports pages

**Self-verify**: Check network tab — `POST /panels` body has `testMasterIds`, not `bundledTestId`.
**Test requirement**: All steps pass manually.
**⚠️ Boundaries**: No code changes in this task.
**CODEBASE.md update?**: Yes — update all sections affected: modules, routes, endpoints, key files.
**Architecture compliance**: N/A — verification task.

**Decisions**: None yet.

---

#### Conformance: Test Master & Panel–Test Linking
> Tick after every task. All items ✅ before feature is shippable.

- [ ] `GET /test-masters` returns list (ADMIN only, 401/403 otherwise)
- [ ] `POST /test-masters` creates with name+status; 409 on duplicate name
- [ ] `PATCH/DELETE /test-masters/:id` work; soft-delete sets deletedAt
- [ ] `POST /panels` with `testMasterIds` creates PanelTest rows; validates each ID
- [ ] `GET /panels` includes `panelTests.testMaster` in response
- [ ] `/admin/tests` page: list, add, activate/deactivate, delete
- [ ] `AddPanelForm` multi-select loads from `GET /test-masters`, BundledTest combobox commented out
- [ ] `PanelsPage` "Tests included" column renders from `panelTests` (with old-data fallback)
- [ ] Existing panels with `bundledTestId` still render without error
- [ ] No regressions in booking, candidate, or auth flows
- [ ] All new tests pass
- [ ] Backend `tsc --noEmit` clean
- [ ] Frontend `tsc -b --noEmit` clean
- [ ] Linter clean (0 errors)
