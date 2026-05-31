import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { randomBytes } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import type { Request } from 'express';
import {
  MAX_REPORT_FILE_BYTES,
  REPORTS_SUBDIR,
  UPLOAD_ROOT,
} from './storage.constants';

const REPORTS_DIR = join(UPLOAD_ROOT, REPORTS_SUBDIR);

const ALLOWED_EXT = ['.pdf', '.png', '.jpg', '.jpeg'];
const ALLOWED_MIME = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
];

function ensureDir() {
  if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });
}

/** Multer options for the report-file upload endpoint. */
export const reportFileMulterOptions = {
  storage: diskStorage({
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
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, accept: boolean) => void,
  ) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.includes(ext) || !ALLOWED_MIME.includes(file.mimetype)) {
      return cb(
        new BadRequestException('Only PDF, PNG and JPG files are allowed'),
        false,
      );
    }
    cb(null, true);
  },
};
