# SPEC — MediSync Medical Management System

> Living document. Edit in-place via `change:` only. Strikethrough removed items, never delete.
> Last updated: 2026-05-25 · Initial spec

---

## Overview

MediSync is a production-ready, role-based medical management platform. It provides secure user registration (OTP email verification), JWT-based authentication, and role-gated access across four permission tiers. The v1 foundation focuses entirely on the auth infrastructure and user management scaffold that all future medical features will build on.

---

## Target Users

| Persona | Role | Needs |
|---------|------|-------|
| System owner | SUPER_ADMIN | Full platform access, user management |
| Hospital admin | ADMIN | Manage staff, view all records |
| Department head | MANAGER | View department data, manage team |
| Staff / clinician | USER | Access own records, limited views |

---

## Core Features

### F-01: OTP Email Registration
**Acceptance criteria:**
- User submits email → system generates 6-digit OTP, stores hashed OTP + 10min expiry on User record
- OTP email sent via Nodemailer SMTP with HTML template
- User submits email + OTP → system validates hash and expiry → returns short-lived setup token (15min JWT)
- User submits setup token + password → system creates User, marks `isEmailVerified: true`, returns access JWT
- If OTP expired: user must restart flow (re-enter email)
- Resend OTP allowed after 60-second cooldown (enforced server-side via `otpResendAllowedAt`)
- Password only required at Step 3 — no name field in registration

### F-02: JWT Login
**Acceptance criteria:**
- `POST /api/v1/auth/login` accepts email + password
- Returns JWT + user object on success
- Returns 401 if credentials invalid
- Returns 403 if `isActive: false` or `isEmailVerified: false`
- JWT expiry configured via `JWT_EXPIRES_IN` env var

### F-03: Role-Based Access Control
**Acceptance criteria:**
- Four roles: `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `USER`
- `JwtAuthGuard` protects all non-public routes
- `RolesGuard` enforces `@Roles()` decorator
- Mismatched role returns 403 with message
- Role stored on User, included in JWT payload

### F-04: User Management APIs
**Acceptance criteria:**
- `GET /api/v1/users` — returns paginated user list (SUPER_ADMIN, ADMIN only)
- `GET /api/v1/users/me` — returns current authenticated user (any role)
- `GET /api/v1/users/:id` — returns user by ID (ADMIN+)
- `POST /api/v1/users` — create user structure (SUPER_ADMIN only)
- Password never returned in any response
- `UserResponseDto` strips sensitive fields

### F-05: Health Check
**Acceptance criteria:**
- `GET /api/v1/health` returns `{ status: 'ok', timestamp }` — no auth required
- Used by frontend/infra to verify API availability

---

## Out of Scope (v1)

- ~~Redis caching~~ — deferred to v2
- Patient records, appointments, prescriptions — Phase 2 features
- Password reset / forgot password flow — v2
- OAuth / social login — v2
- Email templates beyond OTP — v2
- Admin panel for role changes — v2
- Audit logging — v2
- Rate limiting — v2

---

## Tech Stack

### Frontend
| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | React + Vite + TypeScript | Fast DX, strict types |
| Routing | React Router DOM v6 | Industry standard |
| Server state | TanStack Query v5 | Replaces manual loading/error state |
| HTTP | Axios | Interceptor support for JWT |
| Client state | Zustand | Lightweight auth store |
| Styling | Tailwind CSS | Utility-first, no component lib dependency |
| Forms | React Hook Form | Native validation rules (no Zod) |

### Backend
| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | NestJS | Modular, enterprise-ready |
| ORM | Prisma | Type-safe DB access |
| Database | PostgreSQL | Relational, ACID compliant |
| Auth | JWT + Passport + bcrypt | Industry standard |
| Email | Nodemailer + SMTP | Works with Gmail/any SMTP, no external account |
| Docs | Swagger (`@nestjs/swagger`) | Auto-generated API docs |
| Security | Helmet + CORS + ValidationPipe | Defense in depth |

---

## Data Model

### User
```
id               String    PK, cuid()
email            String    unique
password         String?   null until registration complete; bcrypt hashed
role             Role      default: USER
isActive         Boolean   default: true
isEmailVerified  Boolean   default: false
otpCode          String?   bcrypt-hashed 6-digit OTP
otpExpiresAt     DateTime? 10min from issue
otpResendAllowedAt DateTime? 60s cooldown
createdAt        DateTime  auto
updatedAt        DateTime  auto
```

### Role enum
```
SUPER_ADMIN | ADMIN | MANAGER | USER
```

---

## API Shape

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/register/initiate` | public | Send OTP to email |
| POST | `/api/v1/auth/register/verify-otp` | public | Verify OTP → setup token |
| POST | `/api/v1/auth/register/complete` | setup token | Set password → access JWT |
| POST | `/api/v1/auth/login` | public | Email + password → JWT |
| GET | `/api/v1/auth/me` | JWT | Current user |

### Users
| Method | Path | Auth | Roles |
|--------|------|------|-------|
| GET | `/api/v1/users` | JWT | SUPER_ADMIN, ADMIN |
| GET | `/api/v1/users/me` | JWT | any |
| GET | `/api/v1/users/:id` | JWT | ADMIN+ |
| POST | `/api/v1/users` | JWT | SUPER_ADMIN |

### Health
| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/health` | none |

---

## Non-Functional Requirements

- All secrets via environment variables — never hardcoded
- OTP stored hashed (bcrypt) — never plaintext
- Passwords stored hashed (bcrypt, rounds: 12)
- Setup token is a scoped JWT (type: 'setup') — rejected by regular auth guard
- JWT includes: `sub` (userId), `email`, `role`, `type`
- CORS locked to `FRONTEND_URL` env var
- Swagger only in non-production environments
- API prefix: `/api/v1`
- Global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`

---

## Conformance Checklist

v1 is done when:
- [ ] `npm run start:dev` (backend) starts without errors, Swagger loads at `/api/docs`
- [ ] `npm run dev` (frontend) starts without errors
- [ ] OTP registration 3-step flow works end-to-end
- [ ] Login returns JWT; stored in Zustand + localStorage
- [ ] `/dashboard` redirects unauthenticated users to `/login`
- [ ] `/admin/users` returns 403 for USER role
- [ ] `/api/v1/health` returns 200 without auth
- [ ] OTP resend blocked for 60s after last send
- [ ] Password never appears in any API response
- [ ] README covers: prerequisites, env setup, DB migration, run commands
