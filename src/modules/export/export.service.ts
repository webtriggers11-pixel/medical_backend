import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// Column order matches the "Billing data for LR" export format exactly.
const COLUMNS = [
  'orders',
  'ctv',
  'ctc',
  'company_id',
  'company_name',
  'approval_date',
  'requested_date',
  'checkup_date',
  'order_status',
  'checkup_status',
  'order_code',
  'com_store',
  'com_city',
  'com_zone',
  'patient_name',
  'age',
  'sex',
  'emp_id',
  'package_details',
  'store_id',
  'str_email',
  'str_hd_ph',
  'handle',
  'lab_name',
  'lab_id',
  'ml_commission',
  'lab_city',
  'str_phone',
  'collection_date',
  'collection_slot',
  'str_hd_ph',
  'str_hd_name',
  'emp_phone',
  'is_active',
  'order_type',
  'scheduled_next_day',
  'is_approved',
  'test_category',
  'reports_delivered',
  'fulfilled_orders',
] as const;

const BOOKING_INCLUDE = {
  client: { select: { clientId: true, name: true, email: true } },
  lab: { select: { labId: true, name: true } },
  panel: {
    select: {
      panelId: true,
      name: true,
      panelTests: { select: { testMaster: { select: { name: true } } } },
    },
  },
  report: { select: { approvalStatus: true, fitnessStatus: true } },
  scheduleHistory: {
    select: { changedBy: true },
    orderBy: { createdAt: 'asc' },
  },
  candidate: {
    include: { store: { include: { city: { include: { zone: true } } } } },
  },
} satisfies Prisma.BookingInclude;

type BookingRow = Prisma.BookingGetPayload<{ include: typeof BOOKING_INCLUDE }>;

@Injectable()
export class ExportService {
  constructor(private prisma: PrismaService) {}

  // Columns + positional rows — drives both the CSV and the on-screen table.
  async bookingMatrix(range: {
    from?: string;
    to?: string;
  }): Promise<{ columns: string[]; rows: (string | number)[][] }> {
    const where: Prisma.BookingWhereInput = { deletedAt: null };
    // Filter by checkup_date, which is the scheduled date when present and
    // otherwise the candidate's appointment date (mirrors `toRow`'s mapping).
    const checkupDate: Prisma.DateTimeFilter = {};
    if (range.from) {
      const d = new Date(range.from);
      if (!isNaN(d.getTime())) checkupDate.gte = startOfDay(d);
    }
    if (range.to) {
      const d = new Date(range.to);
      if (!isNaN(d.getTime())) checkupDate.lte = endOfDay(d);
    }
    if (checkupDate.gte || checkupDate.lte) {
      where.OR = [
        { scheduledDate: checkupDate },
        { scheduledDate: null, candidate: { appointmentDate: checkupDate } },
      ];
    }

    const bookings = await this.prisma.booking.findMany({
      where,
      include: BOOKING_INCLUDE,
      orderBy: { reqDate: 'desc' },
    });

    return { columns: [...COLUMNS], rows: bookings.map(toRow) };
  }

  // Booking-centric billing export. One row per booking, filtered by reqDate.
  async bookingsCsv(range: { from?: string; to?: string }): Promise<string> {
    const { columns, rows } = await this.bookingMatrix(range);
    const header = columns.join(',');
    const body = rows.map((r) => r.map(cell).join(','));
    return [header, ...body].join('\n') + '\n';
  }
}

function toRow(b: BookingRow): (string | number)[] {
  const c = b.candidate;
  const store = c.store;
  const city = store.city;
  const zone = city.zone;
  const charged = b.amountCharged != null ? Number(b.amountCharged) : null;
  const vendor = b.amountToVendor != null ? Number(b.amountToVendor) : null;
  const tests =
    b.panel?.panelTests
      .map((pt) => pt.testMaster?.name)
      .filter(Boolean)
      .join(',') ?? '';
  const reportDelivered = b.report ? 1 : 0;
  const fulfilled = ['REPORT_UPLOADED', 'FIT', 'UNFIT'].includes(b.status)
    ? 1
    : 0;

  return [
    b.bookingId ?? '', // orders
    vendor ?? '', // ctv (cost to vendor)
    charged ?? '', // ctc (billed to client)
    b.client.clientId ?? '', // company_id
    b.client.name ?? '', // company_name
    '', // approval_date — n/a (only a boolean stored)
    fmtDate(b.reqDate), // requested_date
    fmtDate(b.scheduledDate ?? c.appointmentDate), // checkup_date
    b.status, // order_status
    checkupStatus(b), // checkup_status
    '', // order_code — n/a
    store.name, // com_store
    city.name, // com_city
    zone.name, // com_zone
    c.name, // patient_name
    c.age, // age
    titleCase(c.gender), // sex
    c.employeeCode ?? '', // emp_id
    tests, // package_details
    store.storeId ?? '', // store_id
    store.email ?? '', // str_email
    store.storeHeadMobile, // str_hd_ph
    '', // handle — n/a
    b.lab?.name ?? '', // lab_name
    b.lab?.labId ?? '', // lab_id
    charged != null && vendor != null ? charged - vendor : '', // ml_commission (margin)
    '', // lab_city — n/a
    store.storeContact ?? '', // str_phone
    fmtDate(b.visitTime), // collection_date
    b.timeSlot ?? '', // collection_slot
    store.storeHeadMobile, // str_hd_ph (dup)
    store.storeHeadName, // str_hd_name
    c.mobile, // emp_phone
    c.isActive ? 'Yes' : 'No', // is_active
    c.candidateType, // order_type
    0, // scheduled_next_day — n/a
    c.isApproved ? 1 : 0, // is_approved
    '', // test_category — n/a
    reportDelivered, // reports_delivered
    fulfilled, // fulfilled_orders
  ];
}

// A reschedule is pending when the latest schedule change was made by the
// client (booking owner) rather than an admin; otherwise map status to a label.
function checkupStatus(b: BookingRow): string {
  switch (b.status) {
    case 'APPOINTMENT_REQUESTED':
      return 'requested';
    case 'VISITED':
      return 'visited';
    case 'REPORT_UPLOADED':
    case 'FIT':
    case 'UNFIT':
      return 'done';
    case 'CANCELLED':
      return 'cancelled';
    case 'SCHEDULED': {
      const last = b.scheduleHistory[b.scheduleHistory.length - 1];
      return last && last.changedBy === b.clientId
        ? 'reschedule_requested'
        : 'scheduled';
    }
    default:
      return String(b.status).toLowerCase();
  }
}

/* helpers */

function startOfDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0),
  );
}
function endOfDay(d: Date): Date {
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}
function fmtDate(d?: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : '';
}
function titleCase(s?: string | null): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
// Quote a CSV cell when it contains a comma, quote or newline.
function cell(v: string | number): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
