# Task: Candidate Feature — Add Candidate form + bulk upload (schema-aligned)

Status: **Done** (backend verified end-to-end; frontend builds clean)
Owner: Claude
Source of truth: `medical_backend/prisma/schema.prisma`
Related: USER-only Candidates page (`/candidates`), org hierarchy modules (company → zone → city → store).

## 1. Goal

Make the **Add Candidate** form (see reference screenshot) work end-to-end against the
real schema, with a **Zone → City → Store** cascading selection, full validation, and a
matching bulk-upload CSV flow. All fields are **required except PAN Number**.

## 2. Field specification

| # | Field | Control | Required | Validation | Stored as |
|---|-------|---------|----------|-----------|-----------|
| 1 | Zone | cascade select | ✅ | must pick before City | not stored (derive via store→city→zone) |
| 2 | City | cascade select | ✅ | must pick before Store | not stored (derive via store→city) |
| 3 | Store | cascade select | ✅ | valid store id | `storeId` (+ `companyId` derived from store) |
| 4 | Name | text | ✅ | non-empty | `name` |
| 5 | Employee Code | text | ✅ | non-empty | `employeeCode` |
| 6 | Mobile Number | text | ✅ | exactly 10 digits | `mobile` |
| 7 | Gender | select | ✅ | MALE \| FEMALE \| OTHER | `gender` |
| 8 | Age | number | ✅ | integer 18–100 | `age` |
| 9 | Candidate Type | select | ✅ | NEW_JOINER \| EXISTING \| ANNUAL | `candidateType` |
| 10 | Date of Joining | date picker | ✅ | valid date | `doj` |
| 11 | Pincode | text | ✅ | exactly 6 digits | `pincode` |
| 12 | Email Address | email | ✅ | valid email | `email` |
| 13 | PAN Number | text | ⛔ optional | PAN format `ABCDE1234F` when present | `panNumber` |

## 3. Schema changes (`Candidate`)

The current `Candidate` model has `storeId, companyId, name, employeeCode, mobile,
gender, age, doj?, candidateType, createdBy, deletedAt, deletedBy`. Add the missing
candidate-detail fields and make DOJ required:

- `doj DateTime?` → `doj DateTime` (now required)
- `+ pincode String` (required)
- `+ email   String` (required)
- `+ panNumber String?` (optional)

Migration: `candidates` table is empty, so adding NOT NULL columns + tightening `doj`
is safe. Generate via `prisma migrate diff` → apply with `migrate deploy`.

## 4. Backend changes

- **DTO** (`create-candidate.dto.ts`): `storeId, name, employeeCode` non-empty;
  `mobile` `/^\d{10}$/`; `gender` enum; `age` int 18–100; `candidateType` enum (required);
  `doj` ISO date (required); `pincode` `/^\d{6}$/` (required); `email` IsEmail (required);
  `panNumber` PAN regex (optional).
- **Service** (`candidates.service.ts`): persist new fields; keep deriving `companyId`
  from the selected store.
- **CSV util / template / bulk validation**: columns
  `storeId,name,employeeCode,mobile,gender,age,candidateType,doj,pincode,email,panNumber`.
  All required except `panNumber`. Per-row validation + within-file mobile dedupe +
  unknown-store skip (already present).
- **Cascade read access** (org modules): the Candidates page is USER-role. Grant
  **USER read access** to the list endpoints and relax company-scoping for reads so the
  cascade can populate:
  - `GET /zones` — `companyId` optional → returns all non-deleted zones; `@Roles(ADMIN, USER)`
  - `GET /cities?zoneId=` — `@Roles(ADMIN, USER)`
  - `GET /stores?cityId=` — `@Roles(ADMIN, USER)`
  - (Company select is NOT shown in the form; company is derived from the chosen store.)
  - Writes (POST/PATCH/DELETE) stay ADMIN-only.

## 5. Frontend changes (candidate form/table only)

- **Org services + hooks**: `org.service.ts` (listZones / listCities / listStores) +
  `useZones`, `useCities(zoneId)`, `useStores(cityId)` (TanStack Query, dependent/enabled).
- **types/candidate.types.ts**: align `Candidate` + `CreateCandidateInput` to new fields.
- **candidate.constants.ts**: `GENDER_OPTIONS`, `CANDIDATE_TYPE_OPTIONS`
  (NEW_JOINER / EXISTING / ANNUAL). Remove static zone/city/store lists.
- **AddCandidateModal**: Zone→City→Store cascade (City disabled until Zone chosen, Store
  until City chosen) + all fields; client validation matching §2 (all required except PAN).
- **CandidatesPage table**: Name, Emp Code, Mobile, Gender, Age, Type, Store, DOJ.
- **BulkUploadModal**: update column hint to the new template columns.

## 6. Acceptance criteria

- [x] Schema updated + migration applied; `prisma migrate diff` reports no drift.
- [x] Backend builds; create + bulk endpoints persist all fields; PAN optional, rest required.
- [x] USER can load Zone→City→Store cascade and create a candidate (verified via API).
- [x] Bulk template has all columns; invalid rows reported with reasons; valid rows created.
- [x] Frontend builds; form validates all fields (PAN optional); table shows new columns.
- [x] No `SUPER_ADMIN` / `MANAGER` references anywhere.

## 7. Out of scope (this pass)

- Admin UI to create companies/zones/cities/stores (data seeded/created via API for now).
- Booking / Report / Panel / Notification UI.
- Candidate edit/soft-delete UI.
