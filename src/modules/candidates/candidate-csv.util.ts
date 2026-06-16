/**
 * Minimal, dependency-free CSV helpers for candidate bulk upload.
 * Supports quoted fields, escaped quotes ("") and CRLF/LF line endings.
 */
import { CandidateType, Gender } from '../../common/enums/candidate.enums';

// The store is chosen per row via the storeId column. zone/city are included
// for the uploader's reference (so they can tell rows apart) — the candidate is
// assigned to whatever store the storeId resolves to.
export const CANDIDATE_CSV_COLUMNS = [
  'zone',
  'city',
  'storeId',
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
  storeId: string;
  name: string;
  employeeCode: string | null;
  mobile: string;
  gender: Gender;
  age: number;
  candidateType: CandidateType;
  doj: Date | null;
  appointmentDate: Date;
  pincode: string | null;
  email: string | null;
  panNumber: string | null;
}

// zone/city are reference-only columns; employeeCode, doj, pincode, email and
// panNumber are optional — everything else (including storeId) is required.
const OPTIONAL_COLUMNS: Column[] = [
  'zone',
  'city',
  'employeeCode',
  'doj',
  'pincode',
  'email',
  'panNumber',
];
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

  const storeId = row.storeId?.trim();
  if (!storeId) errors.push('storeId is required');

  const name = row.name?.trim();
  const employeeCode = row.employeeCode?.trim() || null;
  const mobile = row.mobile?.trim();
  if (!name) errors.push('name is required');
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

  // Optional: blank → null. Only reject a value that is present but unparseable.
  const doj = parseDate(row.doj || '');
  if (doj === undefined) errors.push('doj must be a valid date (YYYY-MM-DD)');

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

  // Optional: blank → null. Only validate the format when a value is present.
  const pincode = row.pincode?.trim() || '';
  if (pincode && !/^\d{6}$/.test(pincode)) {
    errors.push('pincode must be 6 digits');
  }

  const email = row.email?.trim() || null;
  if (email && !EMAIL_RE.test(email)) errors.push('email must be valid');

  const panNumber = (row.panNumber?.trim() || '').toUpperCase();
  if (panNumber && !PAN_RE.test(panNumber)) errors.push('panNumber is invalid');

  if (errors.length > 0) {
    return { error: errors.join('; ') };
  }

  return {
    data: {
      storeId: storeId,
      name: name,
      employeeCode: employeeCode,
      mobile: mobile,
      gender: gender as Gender,
      age: ageNum,
      candidateType: candidateType as CandidateType,
      doj: doj ?? null,
      appointmentDate: appointmentDate as Date,
      pincode: pincode || null,
      email,
      panNumber: panNumber || null,
    },
  };
}

/** Format a date as ISO YYYY-MM-DD (UTC). */
function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Escape a CSV cell (quote it if it contains a comma, quote or newline). */
function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Build the downloadable bulk-upload template (header + one example row per
 * store). When `stores` is provided, each example row is pre-filled with that
 * store's real zone, city and storeId so the uploader can copy the right id;
 * otherwise a single placeholder row is emitted.
 */
export function buildCandidateTemplate(
  stores: { zone: string; city: string; storeId: string }[] = [],
): string {
  const header = CANDIDATE_CSV_COLUMNS.join(',');

  // Dates use ISO YYYY-MM-DD. appointmentDate is required and must be a
  // future date; employeeCode, email and panNumber are optional.
  const now = new Date();
  const appointment = new Date(now);
  appointment.setUTCDate(appointment.getUTCDate() + 7);

  const candidateExample: Record<string, string> = {
    name: 'John Doe',
    gender: 'MALE',
    age: '20',
    candidateType: 'NEW_JOINER',
    doj: toIsoDate(now),
    appointmentDate: toIsoDate(appointment),
    pincode: '781001',
    email: 'john.doe@example.com',
    panNumber: 'ABCDE1234F',
  };

  const sources = stores.length
    ? stores
    : [
        {
          zone: 'Zone name',
          city: 'City name',
          storeId: 'paste-store-id-here',
        },
      ];

  const lines = sources.map((s, i) => {
    const record: Record<string, string> = {
      zone: s.zone,
      city: s.city,
      storeId: s.storeId,
      ...candidateExample,
      // vary identity per example row so sample rows don't collide on mobile
      employeeCode: `EMP${1234 + i}`,
      mobile: String(9000000000 + i),
    };
    return CANDIDATE_CSV_COLUMNS.map((c) => csvCell(record[c] ?? '')).join(',');
  });

  return `${header}\n${lines.join('\n')}\n`;
}
