# FEATURE_SPEC.md — Company Profile Fields
> Feature folder: vibe/features/2026-05-28-company-profile-fields/
> Created: 2026-05-28 | Status: Approved

---

## 1. Feature overview

Right now a "company" (corporate client like Pelican Hospitality) is stored as a bare `User` account with only `email`, `name`, and `mobile`. There is no way to record GST number, industry type, billing email, or company address — all fields that are legally and operationally required when issuing invoices and managing a B2B relationship.

This feature adds company profile fields to the `User` model (role=USER) and exposes them through the admin's client management UI and the client's own profile settings.

**Design decision — Zones & Cities remain global:**
Zones (North/South/East/West India) and Cities (Mumbai, Pune etc.) are geographic master data shared across all companies. A company's geographic footprint is naturally derived from where their stores are located. No schema change is needed for zones/cities — querying `stores WHERE clientId = X` grouped by `city.zone` already gives the correct per-company geographic view.

---

## 2. User stories

| As | I want to | So that |
|----|-----------|---------|
| Admin | Record GST number, industry, and billing email when onboarding a new company | I can generate correct tax invoices |
| Admin | Edit a client's company profile at any time | I can keep details current without creating a new account |
| Admin | See company details (GST, industry, address) in the clients list | I can identify and manage clients at a glance |
| Client (USER) | Update my own company profile (name, mobile, address) from my account settings | I don't need to call admin for basic updates |

---

## 3. Acceptance criteria

- [ ] `User` model has new optional fields: `companyName`, `industry`, `gstNumber`, `billingEmail`, `companyAddress`, `companyPan`
- [ ] `PATCH /api/v1/users/:id` (ADMIN) accepts all company profile fields in addition to `isActive`
- [ ] `PATCH /api/v1/users/me` (any authenticated user) allows a client to update their own `name`, `mobile`, `companyName`, `industry`, `gstNumber`, `billingEmail`, `companyAddress`, `companyPan`
- [ ] `GET /api/v1/users` and `GET /api/v1/users/:id` return all new company fields
- [ ] `GET /api/v1/users/me` returns all new company fields
- [ ] Admin's Clients page shows `companyName`, `industry`, `gstNumber` in the list table
- [ ] Admin can open an edit modal per client and update all company profile fields + isActive toggle
- [ ] Client profile page (`/profile`) lets logged-in client view and edit their own company details
- [ ] `/profile` added to sidebar for USER role
- [ ] No existing field is removed or renamed
- [ ] Migration is additive only — all new columns are nullable (`?`)

---

## 4. Scope boundaries

**In scope:**
- Adding company fields to User model via additive migration
- `PATCH /users/me` new endpoint
- Expanding `PATCH /users/:id` beyond just `isActive`
- Admin ClientsPage: show company fields, edit modal
- Client ProfilePage: view + edit own company details

**Explicitly deferred:**
- Separate `Company` entity / table — User IS the company in v1
- Company logo upload
- Multiple users per company (company team members)
- Company-scoped zones/cities — NOT needed (global zones are correct by design)
- GST invoice generation
- Company verification / KYC workflow

---

## 5. Integration points

| Layer | File | Change type |
|-------|------|-------------|
| DB | `prisma/schema.prisma` | Add 6 optional fields to User model |
| DB | `prisma/migrations/` | New additive migration |
| Backend | `src/modules/users/dto/update-client.dto.ts` | Expand beyond isActive |
| Backend | `src/modules/users/dto/user-response.dto.ts` | Expose new fields |
| Backend | `src/modules/users/users.service.ts` | Update setActive → updateClient; add updateMe |
| Backend | `src/modules/users/users.controller.ts` | Expand PATCH /:id; add PATCH /me |
| Frontend | `src/types/user.types.ts` | Add company fields to UserRecord |
| Frontend | `src/services/users.service.ts` | Add updateMe(), expand updateClient() |
| Frontend | `src/features/users/hooks/useUsers.ts` | Add useUpdateMe() hook |
| Frontend | `src/pages/admin/ClientsPage.tsx` | Show company fields, expanded edit modal |
| Frontend | `src/pages/profile/ProfilePage.tsx` | New page — client self-edit |
| Frontend | `src/routes/AppRouter.tsx` | Add /profile route |
| Frontend | `src/components/layout/Sidebar.tsx` | Add Profile nav item for USER |

---

## 6. Data model changes

### Prisma schema — User model additions

```prisma
model User {
  // ... existing fields unchanged ...

  // Company profile fields (all optional — additive only)
  companyName     String?
  industry        String?
  gstNumber       String?
  billingEmail    String?
  companyAddress  String?
  companyPan      String?
}
```

All 6 fields are `String?` (nullable). No existing field is touched.

### Migration
New file: `prisma/migrations/[timestamp]_add_company_profile_fields/migration.sql`

```sql
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "companyName"    TEXT,
  ADD COLUMN IF NOT EXISTS "industry"       TEXT,
  ADD COLUMN IF NOT EXISTS "gstNumber"      TEXT,
  ADD COLUMN IF NOT EXISTS "billingEmail"   TEXT,
  ADD COLUMN IF NOT EXISTS "companyAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "companyPan"     TEXT;
```

---

## 7. New/updated API endpoints

### PATCH /api/v1/users/me  ← NEW
```
Auth:   JWT (any role)
Body:   UpdateMyProfileDto
  name?           string
  mobile?         string
  companyName?    string
  industry?       string
  gstNumber?      string
  billingEmail?   string (valid email)
  companyAddress? string
  companyPan?     string  (PAN format: ABCDE1234F when present)

200:  UserResponseDto (full profile)
401:  not authenticated
```

### PATCH /api/v1/users/:id  ← EXPANDED (was isActive-only)
```
Auth:   JWT (ADMIN only)
Body:   UpdateClientDto (expanded)
  isActive?       boolean
  name?           string
  mobile?         string
  companyName?    string
  industry?       string
  gstNumber?      string
  billingEmail?   string
  companyAddress? string
  companyPan?     string

200:  UserResponseDto
404:  client not found
```

### GET /api/v1/users, GET /api/v1/users/:id, GET /api/v1/users/me  ← EXPANDED response
All now return the 6 new company fields in the response body.

---

## 8. Edge cases and error states

| Case | Handling |
|------|---------|
| Client tries PATCH /users/:id (someone else's profile) | 403 — ADMIN-only route |
| Admin updates isActive=false on a client | Existing behaviour preserved |
| billingEmail is not a valid email | 400 from class-validator `@IsEmail()` |
| companyPan doesn't match PAN regex | 400 from class-validator `@Matches()` |
| PATCH /users/me with no fields sent | 200 — no-op update (all fields optional) |
| gstNumber format validation | Optional — just `@IsString()` in v1, format validation in v2 |

---

## 9. Non-functional requirements

- Migration is additive only — zero downtime, no data loss
- `password`, `otpCode` never returned in any response (existing UserResponseDto rule)
- All new fields nullable in DB — old client records unaffected
- No change to JWT payload shape — no re-login required for existing users

---

## 10. Conformance checklist

Feature is shippable when ALL of these are true:

- [ ] `prisma migrate deploy` runs clean with no errors
- [ ] `PATCH /api/v1/users/me` accepts and persists all 6 company fields
- [ ] `PATCH /api/v1/users/:id` (admin) accepts all 6 fields + isActive
- [ ] `GET /api/v1/users/me` returns new fields
- [ ] Admin ClientsPage shows companyName + industry + gstNumber in the table
- [ ] Admin can edit all company fields for any client via modal
- [ ] Client ProfilePage loads own data and saves updates
- [ ] `/profile` is accessible from sidebar (USER role only)
- [ ] `npm run build` (frontend) passes with zero errors
- [ ] `npm run start:dev` (backend) starts without errors
- [ ] Existing client accounts (null company fields) display gracefully with fallback `—`
