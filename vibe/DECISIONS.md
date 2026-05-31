# DECISIONS.md — MediSync
> Architectural decisions and drift log.

---

## — Feature Start: Test Master & Panel–Test Linking — 2026-05-31
> Folder: vibe/features/2026-05-31-test-master-panel-tests/
> Replace BundledTest with TestMaster in panel creation; add TestMaster CRUD module
> Tasks: TM-01, TM-02, TM-03, TM-04, TM-05, TM-06, TM-07, TM-08 | Estimated: ~20 hours

**Key decisions:**
- TestMaster is **global** (no Lab FK). A test like "Complete Blood Count" is not lab-specific.
- Panel↔TestMaster is **many-to-many via join table** (`panel_tests`) — not a JSON array — for queryability.
- `Panel.bundledTestId` is made **nullable** (not removed) — existing panels keep their data; BundledTest module is untouched.
- BundledTest combobox in `AddPanelForm` is **commented out** (not deleted) — can be restored.
- `PanelsPage` shows TestMaster names from `panelTests` with **fallback to bundledTest.testsIncluded** for old rows.

> Drift logged below.
---

## — Feature Start: Admin Reset Password — 2026-05-31
> Additive only: new PATCH /users/:id/reset-password endpoint + ResetPasswordModal in ClientDetailPage.
> Decision: dedicated sub-route (not extending existing PATCH /users/:id) to keep isActive toggle untouched.
---
