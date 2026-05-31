import { join } from 'path';

/** Absolute root for all uploaded files (served statically at /uploads). */
export const UPLOAD_ROOT = join(process.cwd(), 'uploads');

/** Sub-folder (under UPLOAD_ROOT) for report files. */
export const REPORTS_SUBDIR = 'reports';

/** Public URL prefix the frontend prepends with VITE_API_URL (legacy disk driver). */
export const REPORTS_PUBLIC_PREFIX = `/uploads/${REPORTS_SUBDIR}`;

/** Key prefix for report objects in the S3 bucket. */
export const S3_REPORTS_PREFIX = 'reports';

/** Max size per uploaded report file (10 MB). */
export const MAX_REPORT_FILE_BYTES = 10 * 1024 * 1024;

/** Allowed report file extensions / MIME types. */
export const ALLOWED_REPORT_EXT = ['.pdf', '.png', '.jpg', '.jpeg'];
export const ALLOWED_REPORT_MIME = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
];

/** Storage driver: 's3' (default) or 'disk' (local dev fallback). */
export const STORAGE_DRIVER = (process.env.STORAGE_DRIVER ?? 's3').toLowerCase();
export const isS3Storage = () => STORAGE_DRIVER !== 'disk';
