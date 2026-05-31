# TASKS.md — MediSync
> Human progress view. Updated after every task.

---

## Active features

🔄 **Test Master & Panel–Test Linking** — Replace BundledTest with direct Test selection in Panel creation (0/8)
   Estimated: approx. 20 hours (S: 4, M: 5, L: 1)
   [ ] TM-01 · Prisma schema + migration — add TestMaster, PanelTest tables; make bundledTestId nullable
   [ ] TM-02 · TestMaster backend module — GET/POST/PATCH/DELETE /test-masters endpoints
   [ ] TM-03 · Panel service wiring — create() uses PanelTest join table; findAll/findOne include panelTests
   [ ] TM-04 · Frontend types, service, query keys, hooks — all wiring for TestMaster
   [ ] TM-05 · TestMasterPage (/admin/tests) — CRUD page + sidebar nav + route
   [ ] TM-06 · AddPanelForm: swap BundledTest for TestMaster multi-select
   [ ] TM-07 · PanelsPage: show TestMaster names in "Tests included" column
   [ ] TM-08 · Integration smoke test — full E2E verification
   → Full specs: vibe/features/2026-05-31-test-master-panel-tests/FEATURE_TASKS.md

---

## Completed features

✅ **Admin Reset Password** — Admin can reset a client's login password from the client detail page

---

## What just happened
✅ Test Master & Panel–Test Linking spec and plan approved — ready to build.
   8 tasks, approx. 20 hours

## What's next
⬜ TM-01 · Prisma schema + migration
   Adds two new tables (test_masters, panel_tests) and makes Panel.bundledTestId nullable.
Say "next" to begin.
