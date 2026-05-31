import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { randomBytes } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { diskStorage, memoryStorage } from 'multer';
import type { Request } from 'express';
import {
  ALLOWED_REPORT_EXT,
  ALLOWED_REPORT_MIME,
  isS3Storage,
  MAX_REPORT_FILE_BYTES,
  REPORTS_SUBDIR,
  UPLOAD_ROOT,
} from './storage.constants';

const REPORTS_DIR = join(UPLOAD_ROOT, REPORTS_SUBDIR);

function ensureDir() {
  if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });
}

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: (error: Error | null, accept: boolean) => void,
) => {
  const ext = extname(file.originalname).toLowerCase();
  if (
    !ALLOWED_REPORT_EXT.includes(ext) ||
    !ALLOWED_REPORT_MIME.includes(file.mimetype)
  ) {
    return cb(
      new BadRequestException('Only PDF, PNG and JPG files are allowed'),
      false,
    );
  }
  cb(null, true);
};

/**
 * Multer options for the report-file upload endpoint.
 * - S3 driver   → memoryStorage (we stream the buffer to S3).
 * - disk driver → diskStorage (local dev fallback, served at /uploads).
 */
export const reportFileMulterOptions = {
  storage: isS3Storage()
    ? memoryStorage()
    : diskStorage({
        destination: (_req, _file, cb) => {
          ensureDir();
          cb(null, REPORTS_DIR);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`);
        },
      }),
  limits: { fileSize: MAX_REPORT_FILE_BYTES },
  fileFilter,
};
