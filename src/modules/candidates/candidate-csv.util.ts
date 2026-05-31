/**
 * Minimal, dependency-free CSV helpers for candidate bulk upload.
 * Supports quoted fields, escaped quotes ("") and CRLF/LF line endings.
 */
import { CandidateType, Gender } from '../../common/enums/candidate.enums';

// The store is chosen from a dropdown at upload time (not per row), so it is
// not a CSV column. Every uploaded candidate is assigned to that one store.
export const CANDIDATE_CSV_COLUMNS = [
  'name',
  'employeeCode',
  'mobile',
  'gender',
  'age',
  'candidateType',
  'doj',
  'appointmentDate',
  'pincode',
  'email',
  'panNumber',
] as const;

type Column = (typeof CANDIDATE_CSV_COLUMNS)[number];
export type CandidateCsvRow = Record<Column, string>;

export interface NormalizedCandidate {
  name: string;
  employeeCode: string;
  mobile: string;
  gender: Gender;
  age: number;
  candidateType: CandidateType;
  doj: Date;
  appointmentDate: Date;
  pincode: string;
  email: string;
  panNumber: string | null;
}

// Only panNumber is optional; every other column is required.
const OPTIONAL_COLUMNS: Column[] = ['panNumber'];
const REQUIRED: Column[] = CANDIDATE_CSV_COLUMNS.filter(
  (c) => !OPTIONAL_COLUMNS.includes(c),
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/** Parse a single CSV line into fields, honouring quotes. */
function parseLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields.map((f) => f.trim());
}

/**
 * Parse a CSV buffer into header-keyed row objects.
 * Throws if the header row is missing required columns.
 */
export function parseCandidateCsv(content: string): CandidateCsvRow[] {
  const lines = content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    throw new Error('The uploaded file is empty.');
  }

  const header = parseLine(lines[0]).map((h) => h.toLowerCase());
  const missing = REQUIRED.filter((col) => !header.includes(col.toLowerCase()));
  if (missing.length > 0) {
    throw new Error(
      `Missing required column(s): ${missing.join(', ')}. Download the template for the correct format.`,
    );
  }

  const rows: CandidateCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const record = {} as CandidateCsvRow;
    CANDIDATE_CSV_COLUMNS.forEach((col) => {
      const idx = header.indexOf(col.toLowerCase());
      record[col] = idx >= 0 ? (values[idx] ?? '') : '';
    });
    rows.push(record);
  }

  return rows;
}

/** Parse a date cell (ISO YYYY-MM-DD or DD/MM/YYYY) at UTC midnight. null if blank, undefined if invalid. */
function parseDate(value: string): Date | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    return isNaN(date.getTime()) ? undefined : date;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = new Date(trimmed);
    return isNaN(date.getTime()) ? undefined : date;
  }

  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return undefined;
  return new Date(
    Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()),
  );
}

/** True when a (UTC-midnight) date is strictly after today — i.e. tomorrow or later. */
function isFutureDate(date: Date): boolean {
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  return date.getTime() > today.getTime();
}

/**
 * Validate and normalise a raw CSV row.
 * Returns either a ready-to-insert candidate or a single error string.
 */
export function validateRow(
  row: CandidateCsvRow,
): { data: NormalizedCandidate } | { error: string } {
  const errors: string[] = [];

  const name = row.name?.trim();
  const employeeCode = row.employeeCode?.trim();
  const mobile = row.mobile?.trim();
  if (!name) errors.push('name is required');
  if (!employeeCode) errors.push('employeeCode is required');
  if (!/^\d{10}$/.test(mobile || '')) errors.push('mobile must be 10 digits');

  const gender = (row.gender || '').trim().toUpperCase();
  if (!Object.values(Gender).includes(gender as Gender)) {
    errors.push('gender must be MALE, FEMALE or OTHER');
  }

  const ageNum = Number(row.age);
  if (!Number.isInteger(ageNum) || ageNum < 18 || ageNum > 100) {
    errors.push('age must be a whole number between 18 and 100');
  }

  const candidateType = (row.candidateType || '').trim().toUpperCase();
  if (!Object.values(CandidateType).includes(candidateType as CandidateType)) {
    errors.push('candidateType must be NEW_JOINER, EXISTING or ANNUAL');
  }

  const doj = parseDate(row.doj || '');
  if (!doj) errors.push('doj is required and must be a valid date');

  // Required, must be a valid future date (tomorrow or later).
  const appointmentRaw = (row.appointmentDate || '').trim();
  const appointmentDate = parseDate(appointmentRaw);
  if (!appointmentRaw) {
    errors.push('appointmentDate is required');
  } else if (appointmentDate === undefined) {
    errors.push('appointmentDate must be a valid date (YYYY-MM-DD)');
  } else if (appointmentDate && !isFutureDate(appointmentDate)) {
    errors.push('appointmentDate must be a future date');
  }

  const pincode = row.pincode?.trim() || '';
  if (!/^\d{6}$/.test(pincode)) errors.push('pincode must be 6 digits');

  const email = row.email?.trim() || '';
  if (!EMAIL_RE.test(email)) errors.push('email is required and must be valid');

  const panNumber = (row.panNumber?.trim() || '').toUpperCase();
  if (panNumber && !PAN_RE.test(panNumber)) errors.push('panNumber is invalid');

  if (errors.length > 0) {
    return { error: errors.join('; ') };
  }

  return {
    data: {
      name: name,
      employeeCode: employeeCode,
      mobile: mobile,
      gender: gender as Gender,
      age: ageNum,
      candidateType: candidateType as CandidateType,
      doj: doj as Date,
      appointmentDate: appointmentDate as Date,
      pincode,
      email,
      panNumber: panNumber || null,
    },
  };
}

/** Format a date as ISO YYYY-MM-DD (UTC). */
function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Build the downloadable bulk-upload template (header + one example row). */
export function buildCandidateTemplate(): string {
  const header = CANDIDATE_CSV_COLUMNS.join(',');

  // Dates use ISO YYYY-MM-DD. The store is chosen from a dropdown at upload
  // time, so there is no store column here.
  // appointmentDate is required and must be a future date; panNumber is optional.
  const now = new Date();
  const appointment = new Date(now);
  appointment.setUTCDate(appointment.getUTCDate() + 7);

  const example = [
    'John Doe',
    'EMP1234',
    '9999999999',
    'MALE',
    '20',
    'NEW_JOINER',
    toIsoDate(now),
    toIsoDate(appointment),
    '781001',
    'john.doe@example.com',
    'ABCDE1234F',
  ].join(',');
  return `${header}\n${example}\n`;
}
