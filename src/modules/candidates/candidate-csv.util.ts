import { CandidateType, Gender } from '@prisma/client';

export const CANDIDATE_CSV_COLUMNS = [
  'storeId',
  'companyId',
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
  companyId: string;
  name: string;
  employeeCode: string;
  mobile: string;
  gender: Gender;
  age: number;
  candidateType: CandidateType;
  doj: Date | null;
  pincode: string | null;
  email: string | null;
  panNumber: string | null;
}

const REQUIRED: Column[] = ['storeId', 'companyId', 'name', 'employeeCode', 'mobile', 'gender', 'age', 'candidateType'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

function parseLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(current); current = '';
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields.map((f) => f.trim());
}

export function parseCandidateCsv(content: string): CandidateCsvRow[] {
  const lines = content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) throw new Error('The uploaded file is empty.');

  const header = parseLine(lines[0]).map((h) => h.toLowerCase());
  const missing = REQUIRED.filter((col) => !header.includes(col.toLowerCase()));
  if (missing.length > 0) {
    throw new Error(`Missing required column(s): ${missing.join(', ')}. Download the template for the correct format.`);
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

function parseDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    return isNaN(date.getTime()) ? null : date;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = new Date(trimmed);
    return isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
}

export function validateRow(row: CandidateCsvRow): { data: NormalizedCandidate } | { error: string } {
  const errors: string[] = [];

  const storeId = row.storeId?.trim();
  const companyId = row.companyId?.trim();
  const name = row.name?.trim();
  const employeeCode = row.employeeCode?.trim();
  const mobile = row.mobile?.trim();

  if (!storeId) errors.push('storeId is required');
  if (!companyId) errors.push('companyId is required');
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
    errors.push('candidateType must be NEW_JOINER or EXISTING');
  }

  const doj = parseDate(row.doj || '');

  const pincode = row.pincode?.trim() || '';
  if (pincode && !/^\d{6}$/.test(pincode)) errors.push('pincode must be 6 digits');

  const email = row.email?.trim() || '';
  if (email && !EMAIL_RE.test(email)) errors.push('email is invalid');

  const panNumber = (row.panNumber?.trim() || '').toUpperCase();
  if (panNumber && !PAN_RE.test(panNumber)) errors.push('panNumber is invalid');

  if (errors.length > 0) return { error: errors.join('; ') };

  return {
    data: {
      storeId,
      companyId,
      name,
      employeeCode,
      mobile,
      gender: gender as Gender,
      age: ageNum,
      candidateType: candidateType as CandidateType,
      doj,
      pincode: pincode || null,
      email: email || null,
      panNumber: panNumber || null,
    },
  };
}

export function buildCandidateTemplate(): string {
  const header = CANDIDATE_CSV_COLUMNS.join(',');
  const example = [
    'store_cuid_here',
    'company_cuid_here',
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
