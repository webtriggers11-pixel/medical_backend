import { join } from 'path';

/** Absolute root for all uploaded files (served statically at /uploads). */
export const UPLOAD_ROOT = join(process.cwd(), 'uploads');

/** Sub-folder (under UPLOAD_ROOT) for report files. */
export const REPORTS_SUBDIR = 'reports';

/** Public URL prefix the frontend prepends with VITE_API_URL. */
export const REPORTS_PUBLIC_PREFIX = `/uploads/${REPORTS_SUBDIR}`;

/** Max size per uploaded report file (10 MB). */
export const MAX_REPORT_FILE_BYTES = 10 * 1024 * 1024;
