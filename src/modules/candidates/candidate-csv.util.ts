/**
 * Minimal, dependency-free CSV helpers for candidate bulk upload.
 * Supports quoted fields, escaped quotes ("") and CRLF/LF line endings.
 */
import { CandidateType, Gender } from '../../common/enums/candidate.enums';

export const CANDIDATE_CSV_COLUMNS = [
  'storeId',
  'name',
  'employeeCode',
  'mobile',
  'gender',
  'age',
  'candidateType',
  'doj',
  'pincode',
  'email',
  'panNumber',
] as const;

type Column = (typeof CANDIDATE_CSV_COLUMNS)[number];
export type CandidateCsvRow = Record<Column, string>;

export interface NormalizedCandidate {
  storeId: string;
  name: string;
  employeeCode: string;
  mobile: string;
  gender: Gender;
  age: number;
  candidateType: CandidateType;
  doj: Date;
  pincode: string;
  email: string;
  panNumber: string | null;
}

// Every column is required for bulk upload except panNumber.
const REQUIRED: Column[] = CANDIDATE_CSV_COLUMNS.filter(
  (c) => c !== 'panNumber',
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

/**
 * Validate and normalise a raw CSV row.
 * Returns either a ready-to-insert candidate or a single error string.
 */
export function validateRow(
  row: CandidateCsvRow,
): { data: NormalizedCandidate } | { error: string } {
  const errors: string[] = [];

  const storeId = row.storeId?.trim();
  const name = row.name?.trim();
  const employeeCode = row.employeeCode?.trim();
  const mobile = row.mobile?.trim();
  if (!storeId) errors.push('storeId is required');
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
      storeId: storeId as string,
      name: name as string,
      employeeCode: employeeCode as string,
      mobile: mobile as string,
      gender: gender as Gender,
      age: ageNum,
      candidateType: candidateType as CandidateType,
      doj: doj as Date,
      pincode,
      email,
      panNumber: panNumber || null,
    },
  };
}

/** Build the downloadable bulk-upload template (header + one example row). */
export function buildCandidateTemplate(): string {
  const header = CANDIDATE_CSV_COLUMNS.join(',');
  const example = [
    'paste-store-id-here',
    'John Doe',
    'EMP1234',
    '9999999999',
    'MALE',
    '20',
    'NEW_JOINER',
    '2026-05-22',
    '781001',
    'john.doe@example.com',
    'ABCDE1234F',
  ].join(',');
  return `${header}\n${example}\n`;
}
