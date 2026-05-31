# S3 Report Upload — Integration Plan

How we move candidate report files (PDF + images) from local disk storage to a
private **Amazon S3** bucket, uploaded by the **admin** from the candidate list
in the admin dashboard.

---

## 1. Goal

- Admin uploads one or more report files (PDF / PNG / JPG) for a candidate.
- Files are stored in a **private** S3 bucket (not publicly readable).
- Files are downloaded/viewed via short-lived **pre-signed URLs**.
- The admin dashboard candidate list has an **Upload** button (single **or** multiple files).

---

## 2. Current State (what we're replacing)

| Piece | Today | After |
|---|---|---|
| Storage | Local disk `uploads/reports/` (`diskStorage`) | Amazon S3 bucket (private) |
| Served via | `app.useStaticAssets('/uploads')` (public, static) | Pre-signed GET URL (time-limited) |
| Upload endpoint | `POST /reports/upload` (multer disk) → returns `/uploads/reports/<file>` | `POST /reports/upload` → uploads to S3 → returns `{ fileKey, fileName, fileSize }` |
| `ReportFile.fileUrl` | relative path `/uploads/reports/x.pdf` | S3 **object key** `reports/<candidateId>/<uuid>.pdf` |
| Frontend resolve | `resolveFileUrl()` prepends `VITE_API_URL` | calls a presign endpoint to get a download URL |

> ⚠️ Per project memory: local `/uploads` is **ephemeral on Railway** — this is
> exactly the problem S3 solves. Existing local files (if any) are dev-only.

**Already in place (reuse, don't rebuild):**
- `UploadReportModal` (admin) already supports **multiple files**, per-file
  "tests covered", and a results summary.
- The admin dashboard **Report** column already renders an **Upload** button per
  candidate row (opens `UploadReportModal`).
- `ReportFile` model already has `fileUrl`, `fileName`, `fileSize`, `testsCovered`.

So the bulk of this work is **backend storage swap + download presigning**; the
frontend changes are small.

---

## 3. Architecture Decision

**Recommended: server-side proxy upload + private bucket + pre-signed GET download.**

```
Admin browser ──(multipart POST /reports/upload)──▶ NestJS ──(PutObject)──▶ S3 (private)
                                                      │
                                                      └─ returns { fileKey, fileName, fileSize }

Admin POSTs /reports with file metadata ──▶ ReportFile rows store fileKey

Download:  browser ──(GET /reports/files/:id/url)──▶ NestJS ──(presign GetObject, 5 min)──▶ signed URL ──▶ browser fetches from S3
```

Why this over direct browser→S3 (pre-signed PUT):
- **Minimal change** — keeps the existing multipart endpoint and `UploadReportModal` flow.
- Keeps AWS credentials server-side; no bucket CORS for uploads.
- Lets the backend enforce file-type/size validation centrally.
- Trade-off: report files flow through the API server. Fine for ≤10 MB medical
  docs at this volume. (If we later need large files / high volume, switch the
  *upload* leg to **pre-signed PUT** — see §10 Alternatives.)

Downloads always use **pre-signed GET** so the bucket stays private.

---

## 4. AWS Setup (one-time, ops)

1. **Bucket**: e.g. `medisync-reports-prod` (+ `-staging`). Region e.g. `ap-south-1`.
2. **Block all public access**: ON (bucket stays private).
3. **Encryption**: SSE-S3 (default) or SSE-KMS.
4. **Lifecycle (optional)**: transition to IA after N days; no auto-expiry (reports are records).
5. **IAM user/role** for the API with a least-privilege policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
       "Resource": "arn:aws:s3:::medisync-reports-prod/*"
     }]
   }
   ```
6. **CORS**: only needed if we move to pre-signed PUT (direct browser upload). Not needed for the server-proxy approach.

### Env vars (backend `.env`)
```
AWS_REGION=ap-south-1
AWS_S3_BUCKET=medisync-reports-prod
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_SIGNED_URL_TTL=300            # seconds (download link validity)
# In AWS (Railway), prefer an IAM role / scoped keys stored as secrets.
```
Add these to `CLAUDE.md` env list and Railway service variables.

---

## 5. Backend Changes (NestJS)

### 5.1 Dependencies
```
npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```
Switch report upload multer from `diskStorage` to `memoryStorage` (we stream the buffer to S3).

### 5.2 Config
- `src/config/s3.config.ts` (or reuse ConfigModule): read `AWS_*` env vars.
- `storage.constants.ts`: keep `MAX_REPORT_FILE_BYTES`, allowed ext/mime; add `S3_REPORTS_PREFIX = 'reports'`. Remove disk-path constants once cut over.

### 5.3 New `S3Service` (`src/common/storage/s3.service.ts`)
- `upload(buffer, { key, contentType })` → `PutObjectCommand`.
- `getSignedDownloadUrl(key, ttl)` → `getSignedUrl(GetObjectCommand)`.
- `delete(key)` → `DeleteObjectCommand` (for report deletion / cleanup).
- Build key as `reports/<candidateId-or-bookingId>/<timestamp>-<random>.<ext>`.

### 5.4 Endpoints (`report.controller.ts` / `report.service.ts`)
- **`POST /reports/upload`** (ADMIN): switch multer to `memoryStorage`, keep the
  `fileFilter`/size limit. For each file → `S3Service.upload()` → return
  `{ fileKey, fileName, fileSize }` (rename `fileUrl` → `fileKey` conceptually).
- **`POST /reports`** (ADMIN): unchanged contract, but `ReportFileDto.fileUrl`
  now carries the **S3 key**. (Keep the field name `fileUrl` to avoid a breaking
  rename, or rename to `fileKey` consistently — see §6/§7.)
- **NEW `GET /reports/files/:fileId/url`** (ADMIN + USER, scoped): looks up the
  `ReportFile`, authorizes (admin = any; user = own candidate's report), returns
  `{ url }` from `getSignedDownloadUrl`. This replaces public static serving.
- **(Optional) `DELETE /reports/:id`**: also `S3Service.delete()` each file key.

### 5.5 Remove public static serving
- Drop `app.useStaticAssets(UPLOAD_ROOT, { prefix: '/uploads/' })` from `main.ts`
  once fully cut over (or keep temporarily for legacy local files).

### 5.6 Authorization
- Upload: `@Roles(ADMIN)` (already).
- Presign download: ADMIN any; USER only for files belonging to their own
  candidates (mirror `findAllForUser` scoping via `report → candidate.clientId`).

---

## 6. Data Model

`ReportFile` already has `fileUrl`, `fileName`, `fileSize`, `testsCovered`.

**Decision — store the S3 object key, not a URL:**
- Reuse the existing `fileUrl` column to hold the **S3 key** (no migration), OR
- Add a dedicated `fileKey` column for clarity and keep `fileUrl` null/legacy
  (additive, idempotent migration).

Recommended: **add `fileKey String?`** (additive migration) and write the key
there; treat a value starting with `http`/`/uploads` in old `fileUrl` as legacy.
Cleaner long-term and backward-compatible.

```prisma
model ReportFile {
  // ...existing...
  fileKey String?   // S3 object key (new). fileUrl kept for legacy/local files.
}
```
Migration: `CREATE ... IF NOT EXISTS` style, additive — safe for the live DB.

---

## 7. Frontend Changes (React)

Small — the upload UI already exists.

### 7.1 Upload (admin)
- `report.service.uploadFiles()` — unchanged call; backend now returns
  `{ fileKey, fileName, fileSize }`. Update the `UploadedFile` type
  (`fileUrl` → `fileKey`, or keep `fileUrl` carrying the key).
- `UploadReportModal` — already multi-file; no structural change. Update the
  in-modal "view" link to use the presign endpoint (or hide preview until saved).

### 7.2 Candidate-list Upload button (the ask)
- Already present in `DashboardPage` **Report** column. Confirm/adjust:
  - It currently shows only when a booking exists. Decide: keep gating to
    booked candidates (reports attach to a booking) — **recommended**, since a
    report needs a `bookingId`. Document this in the modal copy.
  - Ensure the modal clearly states "single or multiple files" (it accepts many).

### 7.3 Download / view
- Replace `resolveFileUrl(fileUrl)` direct links with a small helper/hook that
  calls `GET /reports/files/:id/url` and opens the returned signed URL.
- Affects: `ReportsPage` (user panel — file links, "Download selected",
  per-candidate "Download all"), `CandidatesPage`/`CandidateDetailPage` (any file
  links), `UploadReportModal` preview.
- The `ReportsPage` "Download selected / Export ZIP" can now be backed by real
  S3 (server can stream a zip of `GetObject`s) — out of scope here, but unblocked.

---

## 8. Security Notes
- Bucket private + Block Public Access ON; never return raw S3 URLs.
- Pre-signed GET TTL short (e.g. 5 min); generated per request.
- Validate ext + MIME + size server-side (already done) before `PutObject`.
- Scope download presigning by role (USER → own candidates only).
- Store credentials as platform secrets, not in committed `.env`.

---

## 9. Existing Local Files (migration, optional)
- Dev-only local files under `uploads/reports/` are disposable.
- If any prod-relevant files exist, write a one-off script: read disk → `PutObject`
  → set `ReportFile.fileKey`. Otherwise skip.

---

## 10. Alternatives (future scaling)
- **Pre-signed PUT (direct browser → S3)**: backend issues a signed PUT per file;
  browser uploads directly (needs bucket CORS). Removes API bandwidth cost for
  large/high-volume uploads. More moving parts; revisit if needed.
- **CloudFront** in front of S3 with signed cookies/URLs for download CDN.

---

## 11. Implementation Steps (phased)

**Phase 1 — Backend storage swap**
1. Install `@aws-sdk/client-s3` + `s3-request-presigner`.
2. Add S3 config + `S3Service` (upload / presign / delete).
3. Switch `POST /reports/upload` to memory storage + S3 put; return `fileKey`.
4. Add `GET /reports/files/:id/url` (presigned, role-scoped).
5. Add `fileKey` column (additive migration) + write it in `report.service.create`.

**Phase 2 — Frontend wiring**
6. Update `UploadedFile` type + `report.service` to use `fileKey`.
7. Swap all file links to the presign endpoint (ReportsPage, candidate pages, modal).
8. Confirm the candidate-list Upload button + multi-file copy.

**Phase 3 — Cutover & cleanup**
9. Remove `useStaticAssets('/uploads')` (after verifying nothing depends on it).
10. Update `.env`, `CLAUDE.md`, Railway secrets.

---

## 12. Testing Plan
- **Unit**: `S3Service.upload/presign` (mock S3 client).
- **Integration**: upload 1 file and 3 files via the modal → S3 objects created →
  `ReportFile.fileKey` set → presign endpoint returns a working URL.
- **AuthZ**: USER can presign only their own candidate's files; gets 404/403 otherwise.
- **Edge**: oversized file rejected; disallowed type rejected; expired signed URL fails.
- **Regression**: existing reports list / candidate detail still render.

---

## 13. Rollback
- Storage swap is isolated to the upload endpoint + a new presign endpoint.
- Keep `useStaticAssets` + disk multer behind a feature flag (`STORAGE_DRIVER=s3|disk`)
  during rollout so we can flip back without redeploying schema.
- `fileKey` is additive — no destructive change to existing data.

---

## 14. Env Var Summary (add to CLAUDE.md)
```
AWS_REGION
AWS_S3_BUCKET
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=
S3_SIGNED_URL_TTL=300
STORAGE_DRIVER=s3      # optional flag: s3 | disk
```
