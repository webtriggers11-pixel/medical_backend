# CODEBASE.md — MediSync Diagnostics Platform
> 📝 2026-05-31 · Generated during test-master-panel-tests planning

---

## 1. Project overview

B2B medical diagnostics platform. Admin middleman between corporate clients (hotels, factories) and diagnostic labs. Corporate clients send employees for annual health checkups. Admin manages hierarchy, pricing, bookings, and settlements.

**Monorepo layout:**
```
medical/
├── medical_backend/    ← NestJS + Prisma + PostgreSQL
└── medical_frontend/   ← React + Vite + TypeScript
```

---

## 2. Tech stack

### Backend
| Layer | Choice |
|-------|--------|
| Framework | NestJS 11 |
| ORM | Prisma 7 (driver adapter: pg) |
| DB | PostgreSQL |
| Auth | JWT + Passport + bcrypt |
| Email | Resend SDK |
| Docs | Swagger (@nestjs/swagger) |
| Validation | class-validator + class-transformer |

### Frontend
| Layer | Choice |
|-------|--------|
| Framework | React 19 + Vite 8 + TypeScript 6 |
| Routing | React Router DOM v7 |
| Server state | TanStack Query v5 |
| HTTP | Axios (interceptors for JWT) |
| Client state | Zustand |
| Styling | Tailwind CSS v4 |
| Forms | React Hook Form (no Zod) |

---

## 3. Roles

| Role | Label in UI | What they do |
|------|-------------|--------------|
| `ADMIN` | Admin | Manages everything — labs, panels, zones, cities, clients, tests |
| `USER` | Client | A company HR login — manages their own stores and candidates |

`USER` role = a corporate client (company). There is no separate Company model — the User record IS the company.

**Only 2 roles exist in the schema: ADMIN and USER.** (SPEC.md/PLAN.md reference to 4 roles is stale.)

---

## 4. Database schema (Prisma)

Key models and their relationships:

```
User (role=USER = company/client)
  └─ Store (clientId → User.id)
       └─ Candidate (storeId → Store.id, clientId → User.id)
            └─ Booking (candidateId, panelId, labId, clientId)
                 └─ Report (bookingId)

Zone (global master)
  └─ City (zoneId → Zone.id)
       └─ Store (cityId → City.id)

Lab
  └─ LabBundledTest (labId)
  └─ Panel (labId, bundledTestId? nullable)
       └─ ClientPanelPricing (panelId, clientId → User.id)
       └─ PanelTest (panelId → Panel.id, testMasterId → TestMaster.id)

TestMaster (global master — no Lab FK)
  fields: id (PK/unique), name (unique), description? (varchar 255), status, audit cols
  └─ PanelTest

Notification (userId)
```

**User model fields:**
`id, email, name?, mobile?, password?, role, isActive, isEmailVerified, otpCode?, otpExpiresAt?, otpResendAllowedAt?, createdAt, updatedAt, deletedAt?, deletedBy?`

---

## 5. Backend module structure

```
src/
├── app.module.ts
├── main.ts                     ← Helmet, CORS, ValidationPipe, Swagger, port 3000
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── common/
│   ├── decorators/             ← @Roles(), @CurrentUser()
│   ├── enums/                  ← role.enum.ts, candidate.enums.ts
│   ├── filters/                ← http-exception.filter.ts
│   ├── guards/                 ← jwt-auth.guard.ts, roles.guard.ts, setup-token.guard.ts
│   ├── interceptors/           ← transform.interceptor.ts
│   └── pagination/             ← pagination.ts helpers
└── modules/
    ├── auth/                   ← 3-step OTP registration, login, /me
    ├── users/                  ← Client CRUD; PATCH /:id toggle isActive; PATCH /:id/reset-password
    ├── zone/                   ← Global zone master
    ├── city/                   ← Global city master
    ├── store/                  ← Client-owned stores
    ├── candidates/             ← Candidate CRUD + bulk CSV
    ├── lab/                    ← Lab CRUD + BundledTest CRUD (kept intact)
    ├── panel/                  ← Panel CRUD + ClientPanelPricing + PanelTest join
    ├── test-master/            ← TestMaster CRUD (ADMIN only; global master)
    ├── booking/                ← Booking lifecycle
    ├── report/                 ← Report + ReportFile (S3 migration planned)
    ├── mail/                   ← Resend SDK OTP emails
    ├── health/                 ← GET /api/v1/health (public)
    └── seed/                   ← POST /api/v1/seed (dev only)
```

---

## 6. Conventions

### Backend patterns
- Every controller: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(Role.X)` + `@ApiBearerAuth()`
- All responses wrapped by `TransformInterceptor` → `{ data, statusCode, timestamp }`
- Soft deletes: `deletedAt: new Date(), deletedBy: userId` — never hard delete
- DTOs: `class-validator` decorators, `@ApiProperty` on all fields
- UpdateDtos: all fields `@IsOptional()`
- Services: throw `NotFoundException` / `ConflictException` / `BadRequestException` from `@nestjs/common`
- `@CurrentUser()` decorator injects `{ id, email, role }` from JWT payload
- Multi-table writes: use `prisma.$transaction(async tx => {...})`

### Frontend patterns
- API calls: `src/services/[entity].service.ts` → returns typed data, unwrap as `res.data.data`
- Hooks: `src/features/[entity]/hooks/use[Entity].ts` → TanStack Query wrappers
- Types: `src/types/[entity].types.ts`
- Pages: `src/pages/[role]/[Entity]Page.tsx`
- Auth store: Zustand at `src/store/auth.store.ts` → `{ user, token, login, logout }`
- Role guard in routes: `<RoleRoute allowedRoles={ROLE_GROUPS.adminOnly}>` in AppRouter
- Form pattern: `react-hook-form` + `try/catch` + `setApiError(getApiErrorMessage(err))`
- Success messages: inline green banner (`text-emerald-700 bg-emerald-50`) — no toast system
- Error messages: inline red banner (`text-red-600 bg-red-50`)
- Modals: reusable `<Modal>` + `<ConfirmDialog>` components
- Password fields: use `<PasswordInput>` (wraps Input with eye toggle) not raw `<Input type="password">`

---

## 7. API prefix: `/api/v1`

### Key endpoints summary
| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| POST | /auth/register/initiate | public | OTP Step 1 |
| POST | /auth/login | public | |
| GET | /auth/me | JWT | |
| GET | /users | ADMIN | List clients |
| PATCH | /users/:id | ADMIN | isActive toggle |
| PATCH | /users/:id/reset-password | ADMIN | Admin resets client password |
| DELETE | /users/:id | ADMIN | Soft delete |
| GET | /zones | ADMIN,USER | |
| POST | /zones | ADMIN | |
| GET | /cities | ADMIN,USER | ?zoneId required |
| POST | /cities | ADMIN | |
| GET | /stores | ADMIN,USER | |
| POST | /stores | ADMIN,USER | |
| GET | /candidates | ADMIN,USER | |
| POST | /candidates | ADMIN,USER | |
| POST | /candidates/bulk | ADMIN,USER | CSV |
| GET | /labs | ADMIN | |
| POST | /labs | ADMIN | |
| GET | /lab-bundled-tests | ADMIN | ?labId required |
| POST | /lab-bundled-tests | ADMIN | |
| GET | /panels | ADMIN | includes panelTests.testMaster |
| POST | /panels | ADMIN | body: { labId, testMasterIds[], name, mrp, costToVendor } |
| POST | /panels/:id/pricing | ADMIN | Upsert client pricing |
| GET | /test-masters | ADMIN | List active TestMaster records |
| POST | /test-masters | ADMIN | Create test |
| PATCH | /test-masters/:id | ADMIN | Update name/status |
| DELETE | /test-masters/:id | ADMIN | Soft-delete |
| GET | /bookings | ADMIN | |
| POST | /reports | ADMIN | |
| POST | /reports/upload | ADMIN | File upload (local→S3 migration planned) |
| GET | /health | public | |

---

## 8. Frontend route structure

```
/                     → redirect to /dashboard
/login                → LoginPage
/register             → RegisterPage (3-step OTP)
/dashboard            → DashboardPage
/admin/clients        → ClientsPage        [ADMIN]
/admin/clients/:id    → ClientDetailPage   [ADMIN] — panel assignment + reset password
/admin/booking-requests → BookingRequestsPage [ADMIN]
/admin/book-lab       → BookLabPage        [ADMIN]
/admin/zone-city      → ZoneCityPage       [ADMIN]
/admin/zones          → ZonesPage          [ADMIN]
/admin/cities         → CitiesPage         [ADMIN]
/admin/stores         → StoresPage         [ADMIN]
/admin/labs           → LabsPage           [ADMIN]
/admin/panels         → PanelsPage         [ADMIN]
/admin/tests          → TestMasterPage     [ADMIN]  ← new
/candidates           → CandidatesPage     [USER]
/candidates/new       → AddCandidatePage   [USER]
/candidates/:id       → CandidateDetailPage [USER]
/stores               → StoresPage         [USER]
/reports              → ReportsPage        [USER]
/unauthorized         → UnauthorizedPage
/*                    → NotFoundPage
```

---

## 9. Key file paths

### Backend
| Purpose | Path |
|---------|------|
| Prisma schema | `prisma/schema.prisma` |
| Users module | `src/modules/users/` |
| Reset password DTO | `src/modules/users/dto/reset-password.dto.ts` |
| Panel module | `src/modules/panel/` |
| Panel DTO (create) | `src/modules/panel/dto/create-panel.dto.ts` |
| TestMaster module | `src/modules/test-master/` (new) |
| Auth service | `src/modules/auth/auth.service.ts` |

### Frontend
| Purpose | Path |
|---------|------|
| Panel types | `src/types/panel.types.ts` |
| TestMaster types | `src/types/testMaster.types.ts` (new) |
| Panel service | `src/services/panel.service.ts` |
| TestMaster service | `src/services/testMaster.service.ts` (new) |
| TestMaster hooks | `src/features/test-master/hooks/useTestMaster.ts` (new) |
| TestMaster page | `src/pages/admin/TestMasterPage.tsx` (new) |
| Client detail page | `src/pages/admin/ClientDetailPage.tsx` |
| Panels page | `src/pages/admin/PanelsPage.tsx` |
| PasswordInput | `src/components/ui/PasswordInput.tsx` |
| Auth store | `src/store/auth.store.ts` |
| AppRouter | `src/routes/AppRouter.tsx` |
| Sidebar | `src/components/layout/Sidebar.tsx` |
| Query keys | `src/api/queryKeys.ts` |

---

## 10. Deployment

Backend live: `https://medicalbackend-api-prod.up.railway.app` (Railway — local `/uploads` is ephemeral)
Frontend: local dev (Vite) and dist/

### In-progress work
- **S3 report upload migration** — replace local disk storage with private S3 + presigned GET URLs (see `docs/S3_REPORT_UPLOAD_PLAN.md`)
- **Test Master + Panel–Test Linking** — see `vibe/features/2026-05-31-test-master-panel-tests/`
