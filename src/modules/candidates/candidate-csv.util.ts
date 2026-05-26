/**
 * Minimal, dependency-free CSV helpers for candidate bulk upload.
 * Supports quoted fields, escaped quotes ("") and CRLF/LF line endings.
 */
import { CandidateType, Gender } from '../../common/enums/candidate.enums';

export const CANDIDATE_CSV_COLUMNS = [
  'zone',
  'city',
  'store',
  'name',
  'employeeCode',
  'mobileNumber',
  'gender',
  'age',
  'candidateType',
  'dateOfJoining',
  'pincode',
  'email',
  'panNumber',
] as const;

type Column = (typeof CANDIDATE_CSV_COLUMNS)[number];
export type CandidateCsvRow = Record<Column, string>;

export interface NormalizedCandidate {
  zone: string | null;
  city: string | null;
  store: string | null;
  name: string;
  employeeCode: string;
  mobileNumber: string;
  gender: Gender;
  age: number;
  candidateType: CandidateType;
  dateOfJoining: Date;
  pincode: string | null;
  email: string | null;
  panNumber: string | null;
}

const REQUIRED: Column[] = [
  'name',
  'employeeCode',
  'mobileNumber',
  'gender',
  'age',
  'candidateType',
  'dateOfJoining',
];

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

/** Parse a date cell that may be ISO (YYYY-MM-DD) or DD/MM/YYYY. Returns null if invalid. */
function parseDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // DD/MM/YYYY or DD-MM-YYYY — build at UTC midnight to keep the calendar date stable.
  const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    return isNaN(date.getTime()) ? null : date;
  }

  // YYYY-MM-DD — parsed by Date as UTC midnight already.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = new Date(trimmed);
    return isNaN(date.getTime()) ? null : date;
  }

  // Fallback: build from parts at UTC midnight so free-text dates don't shift.
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return null;
  return new Date(
    Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()),
  );
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
  const mobileNumber = row.mobileNumber?.trim();
  if (!name) errors.push('name is required');
  if (!employeeCode) errors.push('employeeCode is required');
  if (!/^\d{10}$/.test(mobileNumber || '')) errors.push('mobileNumber must be 10 digits');

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
    errors.push('candidateType must be EXISTING or NEW');
  }

  const dateOfJoining = parseDate(row.dateOfJoining || '');
  if (!dateOfJoining) errors.push('dateOfJoining must be a valid date');

  const pincode = row.pincode?.trim() || '';
  if (pincode && !/^\d{6}$/.test(pincode)) errors.push('pincode must be 6 digits');

  const email = row.email?.trim() || '';
  if (email && !EMAIL_RE.test(email)) errors.push('email is invalid');

  const panNumber = (row.panNumber?.trim() || '').toUpperCase();
  if (panNumber && !PAN_RE.test(panNumber)) errors.push('panNumber is invalid');

  if (errors.length > 0) {
    return { error: errors.join('; ') };
  }

  return {
    data: {
      zone: row.zone?.trim() || null,
      city: row.city?.trim() || null,
      store: row.store?.trim() || null,
      name,
      employeeCode,
      mobileNumber,
      gender: gender as Gender,
      age: ageNum,
      candidateType: candidateType as CandidateType,
      dateOfJoining: dateOfJoining as Date,
      pincode: pincode || null,
      email: email || null,
      panNumber: panNumber || null,
    },
  };
}

/** Build the downloadable bulk-upload template (header + one example row). */
export function buildCandidateTemplate(): string {
  const header = CANDIDATE_CSV_COLUMNS.join(',');
  const example = [
    'East',
    'Guwahati',
    'Semolina Kitchens Pvt. Ltd.',
    'John Doe',
    'EMP1234',
    '9999999999',
    'MALE',
    '20',
    'EXISTING',
    '2026-05-22',
    '781001',
    'john.doe@example.com',
    'ABCDE1234F',
  ].join(',');
  return `${header}\n${example}\n`;
}
