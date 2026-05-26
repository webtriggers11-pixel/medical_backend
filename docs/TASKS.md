# TASKS.md — MediSync Diagnostics Platform
> Human progress view. Updated after every task. Say "next" after each task.

---

## What we're building

A B2B medical diagnostics platform. Companies onboard → Admin sets up hierarchy (company/zone/city/store) → registers labs and test panels with 3-tier pricing → adds candidates (employees) → books health checkups → tracks visits → uploads reports → marks Fit/Unfit → generates fitness certificates → settles finances.

**Completed so far ✅**
- NestJS backend scaffold with all common infrastructure
- Auth module: OTP email registration (3-step), JWT login, /me endpoint
- Mail module: Resend SDK email
- Health module: GET /api/v1/health
- Users module: basic CRUD
- Seed module: POST /api/v1/seed (creates SUPER_ADMIN + ADMIN)
- Railway deployment live: `https://medicalbackend-api-prod.up.railway.app`
- Seeded users: superadmin@medisync.com / admin@medisync.com

---

## PHASE 1 — Database Schema + Admin Setup Module
> vibe/features/2026-05-26-db-schema-setup-module/

🔄 DB Schema + Company/Zone/City/Store APIs (0/8)
   Estimated: approx. 12 hours (S: 2, M: 4, L: 2)

   [ ] P1-001 · Extend Prisma schema — add all 12 new tables
   [ ] P1-002 · Run migration + verify tables in DB
   [ ] P1-003 · Company CRUD API (ADMIN+)
   [ ] P1-004 · Zone CRUD API (scoped to company)
   [ ] P1-005 · City CRUD API (scoped to zone + company)
   [ ] P1-006 · Store CRUD API (scoped to city + company)
   [ ] P1-007 · Wire all new modules into app.module.ts
   [ ] P1-008 · Test all Setup APIs end-to-end

   → Full specs: vibe/features/2026-05-26-db-schema-setup-module/FEATURE_TASKS.md

---

## PHASE 2 — Lab & Panel Module
> Estimated: ~10 hours

⬜ Lab & Panel Management (0/6)
   [ ] P2-001 · Lab CRUD API (register/edit/list labs)
   [ ] P2-002 · Lab bundled tests CRUD (CBC, X-Ray, etc.)
   [ ] P2-003 · Panel CRUD with 3-tier pricing (MRP / cost_to_vendor / cost_to_client)
   [ ] P2-004 · Company panel pricing (custom price per company per panel)
   [ ] P2-005 · Panel listing with filters (city, lab, type)
   [ ] P2-006 · Test all Lab & Panel APIs end-to-end

---

## PHASE 3 — Candidate & Booking Module
> Estimated: ~10 hours

⬜ Candidate & Booking Management (0/7)
   [ ] P3-001 · Candidate CRUD API (add/edit per store; employee code, mobile, age, DOJ)
   [ ] P3-002 · Booking creation (candidate + panel + lab + date → status: appointment_requested)
   [ ] P3-003 · Lab confirms slot (status: scheduled)
   [ ] P3-004 · Candidate visits (status: visited — lab marks sample collected)
   [ ] P3-005 · Booking status state machine + validation
   [ ] P3-006 · Booking list/filter API (by company, store, status, date range)
   [ ] P3-007 · Test booking lifecycle end-to-end

---

## PHASE 4 — Report, Certificate & Settlement Module
> Estimated: ~8 hours

⬜ Report & Settlement (0/5)
   [ ] P4-001 · Lab uploads report (PDF URL + fitness_status → status: report_uploaded)
   [ ] P4-002 · Admin marks Fit / Unfit (reviews report, updates booking status)
   [ ] P4-003 · Fitness certificate generation (Fit candidates → downloadable PDF/record)
   [ ] P4-004 · Financial settlement record (company invoiced, lab paid, margin kept)
   [ ] P4-005 · Settlement summary API (per company, per period)

---

## PHASE 5 — Frontend: Admin Dashboard
> Estimated: ~20 hours

⬜ Admin Dashboard UI (0/12)
   [ ] P5-001 · DashboardLayout — sidebar, topbar, role-aware nav
   [ ] P5-002 · Company management page (list, create, edit)
   [ ] P5-003 · Zone & City management page
   [ ] P5-004 · Store management page (3-step creation wizard)
   [ ] P5-005 · Lab management page
   [ ] P5-006 · Panel management page (pricing table)
   [ ] P5-007 · Candidate management page (per store, bulk add)
   [ ] P5-008 · Booking management page (create, list, status tracking)
   [ ] P5-009 · Report upload page (lab view)
   [ ] P5-010 · Admin review page (mark Fit/Unfit)
   [ ] P5-011 · Fitness certificate view/download
   [ ] P5-012 · Settlement dashboard

---

## PHASE 6 — Polish & Deploy
> Estimated: ~6 hours

⬜ Polish & Production Hardening (0/4)
   [ ] P6-001 · Lock CORS to FRONTEND_URL (remove wildcard)
   [ ] P6-002 · File upload for reports (S3/Cloudinary integration)
   [ ] P6-003 · Notifications module (SMS/WhatsApp via Twilio or MSG91)
   [ ] P6-004 · Full E2E test: company onboard → candidate → booking → report → certificate

---

## What just happened
✅ Development plan created — all 6 phases mapped. Phase 1 spec ready.
   42 tasks total, approx. 66 hours

## What's next
⬜ P1-001 · Extend Prisma schema with all 12 new tables
   When done: migration runs and all tables exist in DB
Say "next" to begin Phase 1.
