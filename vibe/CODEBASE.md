# CODEBASE.md — MediSync Diagnostics Platform
> 📝 2026-05-28 · Generated during company-profile-fields planning

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
| `ADMIN` | Admin | Manages everything — labs, panels, zones, cities, clients |
| `USER` | Client | A company HR login — manages their own stores and candidates |

`USER` role = a corporate client (company). There is no separate Company model — the User record IS the company.

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
  └─ Panel (labId, bundledTestId)
       └─ ClientPanelPricing (panelId, clientId → User.id)

Notification (userId)
```

**User model current fields:**
`id, email, name?, mobile?, password?, role, isActive, isEmailVerified, otpCode?, otpExpiresAt?, otpResendAllowedAt?, createdAt, updatedAt, deletedAt?, deletedBy?`

**Missing company fields on User:**
`companyName?, industry?, gstNumber?, billingEmail?, companyAddress?, companyPan?`

---

## 5. Backend module structure

```
src/
├── app.module.ts               ← registers all modules
├── main.ts                     ← Helmet, CORS, ValidationPipe, Swagger, port 3000
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── common/
│   ├── decorators/             ← @Roles(), @CurrentUser()
│   ├── enums/                  ← role.enum.ts, candidate.enums.ts
│   ├── filters/                ← http-exception.filter.ts
│   ├── guards/                 ← jwt-auth.guard.ts, roles.guard.ts, setup-token.guard.ts
│   └── interceptors/           ← transform.interceptor.ts (wraps all responses in {data,statusCode,timestamp})
└── modules/
    ├── auth/                   ← 3-step OTP registration, login, /me
    ├── users/                  ← CRUD for clients; PATCH /users/:id only toggles isActive
    ├── zone/                   ← Global zone master (ADMIN + USER read)
    ├── city/                   ← Global city master (ADMIN + USER read)
    ├── store/                  ← Client-owned stores (PATCH/DELETE ADMIN only — bug)
    ├── candidates/             ← Candidate CRUD + bulk CSV (no PATCH/DELETE yet)
    ├── lab/                    ← Lab CRUD + BundledTest CRUD
    ├── panel/                  ← Panel CRUD + ClientPanelPricing
    ├── mail/                   ← Resend SDK OTP emails
    ├── health/                 ← GET /api/v1/health (public)
    └── seed/                   ← POST /api/v1/seed (creates ADMIN + USER seed accounts)
```

---

## 6. Conventions

### Backend patterns
- Every controller: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(Role.X)`
- All responses wrapped by `TransformInterceptor` → `{ data, statusCode, timestamp }`
- Soft deletes: `deletedAt: new Date(), deletedBy: userId` — never hard delete
- DTOs: `class-validator` decorators, `@ApiProperty` on all fields
- UpdateDtos: all fields `@IsOptional()`, extend or duplicate CreateDto fields
- Services: throw `NotFoundException` / `ConflictException` / `BadRequestException` from `@nestjs/common`
- `@CurrentUser()` decorator injects `{ id, email, role }` from JWT payload

### Frontend patterns
- API calls: `src/services/[entity].service.ts` → returns typed data
- Hooks: `src/features/[entity]/hooks/use[Entity].ts` → TanStack Query wrappers
- Types: `src/types/[entity].types.ts`
- Pages: `src/pages/[role]/[Entity]Page.tsx`
- All API responses: `ApiResponse<T>` shape → `res.data.data`
- Auth store: Zustand at `src/store/auth.store.ts` → `{ user, token, login, logout }`
- Role guard in routes: `<RoleRoute allowedRoles={ROLE_GROUPS.adminOnly}>` in AppRouter
- Form submission pattern: `react-hook-form` + `try/catch` + `setApiError(getApiErrorMessage(err))`

---

## 7. API prefix

All routes: `/api/v1/[resource]`

### Existing endpoints summary
| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| POST | /auth/register/initiate | public | Step 1 OTP |
| POST | /auth/register/verify-otp | public | Step 2 |
| POST | /auth/register/complete | setup-token | Step 3 |
| POST | /auth/login | public | |
| GET | /auth/me | JWT | |
| GET | /users | ADMIN | List clients |
| GET | /users/me | any | Own profile |
| GET | /users/:id | ADMIN | |
| POST | /users | ADMIN | Create client |
| PATCH | /users/:id | ADMIN | isActive toggle only |
| DELETE | /users/:id | ADMIN | Soft delete |
| GET | /zones | ADMIN,USER | |
| POST | /zones | ADMIN | |
| PATCH | /zones/:id | ADMIN | |
| DELETE | /zones/:id | ADMIN | |
| GET | /cities | ADMIN,USER | ?zoneId required |
| POST | /cities | ADMIN | |
| PATCH | /cities/:id | ADMIN | |
| DELETE | /cities/:id | ADMIN | |
| GET | /stores | ADMIN,USER | |
| POST | /stores | ADMIN,USER | |
| GET | /stores/:id | ADMIN | ← should also allow USER owner |
| PATCH | /stores/:id | ADMIN | ← should also allow USER owner |
| DELETE | /stores/:id | ADMIN | |
| GET | /candidates | ADMIN,USER | |
| POST | /candidates | ADMIN,USER | |
| GET | /candidates/template | ADMIN,USER | CSV download |
| POST | /candidates/bulk | ADMIN,USER | |
| GET | /labs | ADMIN | |
| POST | /labs | ADMIN | |
| PATCH | /labs/:id | ADMIN | |
| DELETE | /labs/:id | ADMIN | |
| GET | /lab-bundled-tests | ADMIN | ?labId required |
| POST | /lab-bundled-tests | ADMIN | |
| PATCH | /lab-bundled-tests/:id | ADMIN | |
| DELETE | /lab-bundled-tests/:id | ADMIN | |
| GET | /panels | ADMIN | |
| POST | /panels | ADMIN | |
| PATCH | /panels/:id | ADMIN | |
| DELETE | /panels/:id | ADMIN | |
| POST | /panels/:id/pricing | ADMIN | Upsert client pricing |
| GET | /panels/:id/pricing | ADMIN | |
| DELETE | /panels/:id/pricing/:clientId | ADMIN | |
| GET | /health | public | |
| POST | /seed | public | Dev only |

---

## 8. Frontend route structure

```
/                     → redirect to /dashboard
/login                → LoginPage
/register             → RegisterPage (3-step)
/dashboard            → DashboardPage (role-aware: admin vs client view)
/admin/clients        → ClientsPage        [ADMIN]
/admin/zones          → ZonesPage          [ADMIN]
/admin/cities         → CitiesPage         [ADMIN]
/admin/labs           → LabsPage           [ADMIN]
/admin/panels         → PanelsPage         [ADMIN]
/candidates           → CandidatesPage     [USER]
/candidates/new       → AddCandidatePage   [USER]
/stores               → StoresPage         [USER]
/stores/new           → AddStorePage       [USER]
/unauthorized         → UnauthorizedPage
/*                    → NotFoundPage
```

---

## 9. Key file paths

### Backend
| Purpose | Path |
|---------|------|
| Prisma schema | `prisma/schema.prisma` |
| User module | `src/modules/users/` |
| Users controller | `src/modules/users/users.controller.ts` |
| Users service | `src/modules/users/users.service.ts` |
| User DTOs | `src/modules/users/dto/` |
| Auth service | `src/modules/auth/auth.service.ts` |
| Store controller | `src/modules/store/store.controller.ts` |

### Frontend
| Purpose | Path |
|---------|------|
| User types | `src/types/user.types.ts` |
| Users service | `src/services/users.service.ts` |
| Users hooks | `src/features/users/hooks/useUsers.ts` |
| Clients page | `src/pages/admin/ClientsPage.tsx` |
| Auth store | `src/store/auth.store.ts` |
| AppRouter | `src/routes/AppRouter.tsx` |

---

## 10. Migrations

All migrations in `prisma/migrations/`. Latest:
- `20260527140000_add_user_soft_delete` — adds deletedAt/deletedBy to users

Next migration needed: add company profile fields to users table.

---

## 11. Deployment

Backend live: `https://medicalbackend-api-prod.up.railway.app` (Railway)
Frontend: local dev only so far
