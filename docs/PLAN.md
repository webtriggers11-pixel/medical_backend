# PLAN — MediSync Medical Management System
> Read every session before writing code. Source of truth for structure and phases.

---

## Project Structure

```
medisync/
├── frontend/                          ← React + Vite + TypeScript
│   ├── public/
│   ├── src/
│   │   ├── api/
│   │   │   ├── axios.instance.ts      ← base axios + interceptors
│   │   │   └── queryKeys.ts           ← centralized TanStack Query keys
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   │   ├── ErrorBoundary.tsx
│   │   │   │   └── EmptyState.tsx
│   │   │   ├── forms/
│   │   │   │   └── FormField.tsx      ← RHF Controller + label + error
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── Topbar.tsx
│   │   │   │   └── PageHeader.tsx
│   │   │   └── ui/
│   │   │       ├── Button.tsx
│   │   │       ├── Input.tsx
│   │   │       ├── Card.tsx
│   │   │       ├── Badge.tsx
│   │   │       ├── Spinner.tsx
│   │   │       └── OtpInput.tsx       ← 6-box OTP input component
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   │   ├── hooks/
│   │   │   │   │   ├── useInitiateRegister.ts
│   │   │   │   │   ├── useVerifyOtp.ts
│   │   │   │   │   ├── useCompleteRegister.ts
│   │   │   │   │   └── useLogin.ts
│   │   │   │   └── components/
│   │   │   │       ├── EmailStep.tsx
│   │   │   │       ├── OtpStep.tsx
│   │   │   │       └── PasswordStep.tsx
│   │   │   ├── dashboard/
│   │   │   ├── users/
│   │   │   │   └── hooks/
│   │   │   │       └── useUsers.ts
│   │   │   └── roles/
│   │   ├── hooks/
│   │   │   └── useCurrentUser.ts
│   │   ├── layouts/
│   │   │   ├── AuthLayout.tsx
│   │   │   └── DashboardLayout.tsx
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   └── RegisterPage.tsx   ← contains 3-step state machine
│   │   │   ├── dashboard/
│   │   │   │   └── DashboardPage.tsx
│   │   │   ├── admin/
│   │   │   │   └── UsersPage.tsx
│   │   │   └── user/
│   │   ├── routes/
│   │   │   ├── AppRouter.tsx
│   │   │   ├── ProtectedRoute.tsx
│   │   │   └── RoleRoute.tsx
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   └── users.service.ts
│   │   ├── store/
│   │   │   └── auth.store.ts          ← Zustand: { user, token, login, logout }
│   │   ├── types/
│   │   │   ├── auth.types.ts
│   │   │   ├── user.types.ts
│   │   │   └── api.types.ts
│   │   ├── utils/
│   │   │   └── token.utils.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── tailwind.config.ts
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── .env
│   └── .env.example
│
├── backend/                           ← NestJS
│   ├── src/
│   │   ├── common/
│   │   │   ├── decorators/
│   │   │   │   ├── roles.decorator.ts
│   │   │   │   └── current-user.decorator.ts
│   │   │   ├── dto/
│   │   │   │   └── pagination.dto.ts
│   │   │   ├── enums/
│   │   │   │   └── role.enum.ts
│   │   │   ├── filters/
│   │   │   │   └── http-exception.filter.ts
│   │   │   ├── guards/
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   └── roles.guard.ts
│   │   │   ├── interceptors/
│   │   │   │   └── transform.interceptor.ts
│   │   │   ├── middleware/
│   │   │   └── pipes/
│   │   │       └── parse-int.pipe.ts
│   │   ├── config/
│   │   │   ├── app.config.ts
│   │   │   ├── database.config.ts
│   │   │   └── jwt.config.ts
│   │   ├── prisma/
│   │   │   ├── prisma.module.ts
│   │   │   ├── prisma.service.ts
│   │   │   └── schema.prisma
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── dto/
│   │   │   │   │   ├── initiate-register.dto.ts
│   │   │   │   │   ├── verify-otp.dto.ts
│   │   │   │   │   ├── complete-register.dto.ts
│   │   │   │   │   ├── login.dto.ts
│   │   │   │   │   └── auth-response.dto.ts
│   │   │   │   └── strategies/
│   │   │   │       └── jwt.strategy.ts
│   │   │   ├── mail/
│   │   │   │   ├── mail.module.ts
│   │   │   │   ├── mail.service.ts
│   │   │   │   └── templates/
│   │   │   │       └── otp.template.ts
│   │   │   ├── users/
│   │   │   │   ├── users.module.ts
│   │   │   │   ├── users.controller.ts
│   │   │   │   ├── users.service.ts
│   │   │   │   └── dto/
│   │   │   │       ├── create-user.dto.ts
│   │   │   │       └── user-response.dto.ts
│   │   │   └── health/
│   │   │       ├── health.module.ts
│   │   │       └── health.controller.ts
│   │   ├── shared/
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── prisma/
│   │   └── schema.prisma
│   ├── .env
│   └── .env.example
│
└── README.md
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    BROWSER                           │
│  React + Vite + TypeScript                           │
│  ┌──────────┐  ┌────────────────┐  ┌─────────────┐ │
│  │  Zustand │  │ TanStack Query │  │ React Router│ │
│  │ authStore│  │ server cache   │  │ protected   │ │
│  └──────────┘  └────────────────┘  └─────────────┘ │
│         │              │                             │
│  ┌──────────────────────────────┐                   │
│  │   Axios Instance             │                   │
│  │   + JWT interceptor          │                   │
│  │   + 401 → logout redirect    │                   │
│  └──────────────────────────────┘                   │
└───────────────────┬─────────────────────────────────┘
                    │ HTTPS  /api/v1/*
┌───────────────────▼─────────────────────────────────┐
│                  NestJS API                          │
│  main.ts: Helmet + CORS + ValidationPipe + Swagger   │
│  ┌─────────────────────────────────────────────────┐│
│  │  GlobalExceptionFilter  TransformInterceptor    ││
│  └─────────────────────────────────────────────────┘│
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌────────┐  │
│  │   Auth   │ │  Users   │ │  Mail   │ │ Health │  │
│  │ Module   │ │ Module   │ │ Module  │ │ Module │  │
│  └────┬─────┘ └────┬─────┘ └────┬────┘ └────────┘  │
│       │            │            │                    │
│  ┌────▼────────────▼────┐  ┌────▼────────────────┐  │
│  │   PrismaService      │  │  Nodemailer/SMTP     │  │
│  └──────────┬───────────┘  └─────────────────────┘  │
└─────────────┼───────────────────────────────────────┘
              │
┌─────────────▼───────────┐
│     PostgreSQL           │
│  User table              │
│  (OTP fields on User)    │
└─────────────────────────┘
```

---

## Tech Stack Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| No Zod on frontend | RHF native validation | Simpler, fewer deps, sufficient for forms |
| OTP on User model | Single table | Avoids join complexity for v1; move to separate table if needed |
| OTP hashed with bcrypt | bcrypt | Treats OTP as a temporary credential |
| Setup token as scoped JWT | `type: 'setup'` claim | Reuses JWT infra; guard rejects wrong type |
| No Redis v1 | In-memory / DB state | Redis deferred — cooldown tracked in DB field |
| TanStack Query | v5 | Built-in loading/error/refetch; replaces manual state |
| Nodemailer + SMTP | Self-hosted | No external API key required for development |

---

## Phase Breakdown

### Phase 1 — Foundation
**Goal:** Both apps start. DB connected. Swagger accessible. No features yet.

Tasks:
- TASK-001: Backend NestJS scaffold + deps install
- TASK-002: Prisma schema + PrismaModule/Service
- TASK-003: ConfigModule + env validation + main.ts (Helmet, CORS, ValidationPipe, Swagger, versioning)
- TASK-004: Global exception filter + transform interceptor
- TASK-005: Frontend Vite scaffold + deps install
- TASK-006: Tailwind configured + base folder structure
- TASK-007: Axios instance + query client setup + Zustand store skeleton
- TASK-008: Populate CODEBASE.md from scaffolded project

**Gate:** Both `npm run start:dev` and `npm run dev` run clean. `/api/docs` loads.

### Phase 2 — Mail Module
**Goal:** SMTP wired, OTP email sends successfully.

Tasks:
- TASK-009: MailModule + MailService (Nodemailer transport)
- TASK-010: OTP HTML email template
- TASK-011: Smoke test email send (manual curl or unit test)

**Gate:** Email arrives in inbox with 6-digit OTP.

### Phase 3 — Auth Module (Backend)
**Goal:** All 5 auth endpoints working with correct validation.

Tasks:
- TASK-012: Role enum + common decorators (Roles, CurrentUser)
- TASK-013: JWT strategy + JwtAuthGuard + RolesGuard
- TASK-014: `POST /auth/register/initiate` — generate + hash OTP, send email, enforce 60s cooldown
- TASK-015: `POST /auth/register/verify-otp` — validate OTP hash + expiry, return setup token
- TASK-016: `POST /auth/register/complete` — validate setup token type, hash password, create user, return JWT
- TASK-017: `POST /auth/login` — validate credentials, check isActive + isEmailVerified, return JWT
- TASK-018: `GET /auth/me` — protected, return current user

**Gate:** Postman/curl full registration flow works. Login returns JWT. /me returns user.

### Phase 4 — Users Module (Backend)
**Goal:** Role-protected user APIs.

Tasks:
- TASK-019: UsersModule + UsersService + UserResponseDto (strips password)
- TASK-020: `GET /users` (ADMIN+), `GET /users/me` (any), `GET /users/:id` (ADMIN+)
- TASK-021: `POST /users` (SUPER_ADMIN only) — create user structure

**Gate:** Role mismatches return 403. Password absent from all responses.

### Phase 5 — Health Module
- TASK-022: HealthModule + `GET /health` — public, returns `{ status, timestamp }`

### Phase 6 — Frontend Auth Flow
**Goal:** Login + 3-step registration working end-to-end with backend.

Tasks:
- TASK-023: Auth service functions (initiateRegister, verifyOtp, completeRegister, login, getMe)
- TASK-024: TanStack Query hooks (useInitiateRegister, useVerifyOtp, useCompleteRegister, useLogin, useCurrentUser)
- TASK-025: Zustand auth store (token persist to localStorage, rehydrate on load)
- TASK-026: AppRouter + ProtectedRoute + RoleRoute
- TASK-027: AuthLayout + LoginPage
- TASK-028: RegisterPage — 3-step state machine (EmailStep → OtpStep → PasswordStep)
- TASK-029: OtpInput component — 6 individual boxes, auto-focus, backspace handling
- TASK-030: 60s resend countdown UI in OtpStep
- TASK-031: DashboardLayout — sidebar + topbar + outlet
- TASK-032: DashboardPage (any auth) + UsersPage (ADMIN+) + UnauthorizedPage + NotFoundPage

**Gate:** Full E2E: register → verify OTP → set password → login → dashboard. Wrong role → /unauthorized.

### Phase 7 — UI Components
Tasks:
- TASK-033: Button, Input, Card, Badge, Spinner, Avatar components
- TASK-034: Sidebar with role-aware nav links
- TASK-035: Topbar with user avatar + logout
- TASK-036: FormField wrapper, EmptyState, ErrorBoundary

### Phase 8 — Polish & Hardening
Tasks:
- TASK-037: 401 response → auto-logout + redirect to /login (axios interceptor)
- TASK-038: isActive check on login (403 with clear message)
- TASK-039: Backend .env.example + frontend .env.example
- TASK-040: README.md — prerequisites, env setup, DB migration, run commands
- TASK-041: Final conformance checklist review

---

## Data Model (Full)

```prisma
enum Role {
  SUPER_ADMIN
  ADMIN
  MANAGER
  USER
}

model User {
  id                    String    @id @default(cuid())
  email                 String    @unique
  password              String?
  role                  Role      @default(USER)
  isActive              Boolean   @default(true)
  isEmailVerified       Boolean   @default(false)
  otpCode               String?
  otpExpiresAt          DateTime?
  otpResendAllowedAt    DateTime?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}
```

---

## API Contract

### POST /api/v1/auth/register/initiate
```
Body:   { email: string }
200:    { message: "OTP sent", resendAllowedAt: ISO8601 }
409:    email already registered and verified
429:    OTP resend too soon (includes secondsRemaining)
```

### POST /api/v1/auth/register/verify-otp
```
Body:   { email: string, otp: string }
200:    { setupToken: string }
400:    invalid or expired OTP
```

### POST /api/v1/auth/register/complete
```
Body:   { password: string }
Header: Authorization: Bearer <setupToken>
200:    { accessToken: string, user: UserResponseDto }
401:    invalid or expired setup token
```

### POST /api/v1/auth/login
```
Body:   { email: string, password: string }
200:    { accessToken: string, user: UserResponseDto }
401:    invalid credentials
403:    account inactive or email not verified
```

### GET /api/v1/auth/me
```
Header: Authorization: Bearer <accessToken>
200:    UserResponseDto
401:    missing or invalid token
```

---

## Environment Variables

### Backend (.env)
```
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/medisync
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRES_IN=7d
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="MediSync <noreply@medisync.com>"
FRONTEND_URL=http://localhost:5173
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:3000
```
