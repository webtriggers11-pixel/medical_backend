/**
 * Reschedule-flow test fixture.
 *
 * Creates a self-contained, clearly-labelled set of records so the
 * appointment-reschedule flow can be tested end to end:
 *
 *   • A test CLIENT login           (rstest.client@medisync.com / Test@123)
 *   • A test store for that client
 *   • Candidate / Booking "A"  — SCHEDULED, scheduled date in the PAST, no
 *                                 reschedule history. The client should see a
 *                                 "Reschedule" button; the admin should NOT.
 *   • Candidate / Booking "B"  — SCHEDULED, already rescheduled once (has
 *                                 history), new date in the FUTURE. The admin
 *                                 should see a "Reschedule" button + a
 *                                 "Rescheduled" badge; the client should not.
 *
 * Everything is idempotent (upsert by a fixed test id) and prefixed so it can
 * be removed again with `seed-reschedule-test-cleanup.ts`.
 *
 * Run:  npx ts-node --project tsconfig.json -r tsconfig-paths/register prisma/seed-reschedule-test.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

const TEST_CLIENT_EMAIL = 'rstest.client@medisync.com';
const TEST_CLIENT_PASSWORD = 'Test@123';

const daysFromNow = (n: number) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
};

async function main() {
  // ── prerequisites (reuse whatever master data already exists) ──────────
  const city = await prisma.city.findFirst({ where: { deletedAt: null } });
  if (!city) {
    throw new Error('No city found — run the main seed (npx prisma db seed) first.');
  }

  // A panel is optional for the reschedule logic (it only needs status +
  // scheduledDate) but makes the booking display realistic when present.
  const panel = await prisma.panel.findFirst({
    where: { deletedAt: null, status: 'ACTIVE' },
    include: { lab: true },
  });

  const amountCharged = panel ? Number(panel.mrp) : 1000;
  const amountToVendor = panel ? Number(panel.costToVendor) : 600;

  // ── test client (role USER) ────────────────────────────────────────────
  const hashed = await bcrypt.hash(TEST_CLIENT_PASSWORD, 12);
  const client = await prisma.user.upsert({
    where: { email: TEST_CLIENT_EMAIL },
    create: {
      email: TEST_CLIENT_EMAIL,
      password: hashed,
      name: 'Reschedule Test Client',
      mobile: '9000000000',
      role: 'USER',
      isEmailVerified: true,
      isActive: true,
    },
    update: { password: hashed, isEmailVerified: true, isActive: true },
  });

  // optional: assign the panel to this client so admin "Book" also works
  if (panel) {
    await prisma.clientPanelPricing.upsert({
      where: { clientId_panelId: { clientId: client.id, panelId: panel.id } },
      create: {
        clientId: client.id,
        panelId: panel.id,
        costToClient: amountCharged,
        discountedPrice: amountCharged,
      },
      update: {},
    });
  }

  // ── test store ─────────────────────────────────────────────────────────
  const store = await prisma.store.upsert({
    where: { clientId_storeCode: { clientId: client.id, storeCode: 'RSTEST01' } },
    create: {
      clientId: client.id,
      cityId: city.id,
      storeCode: 'RSTEST01',
      name: 'Reschedule Test Store',
      address: '1 Test Street',
      storeHeadName: 'Test Head',
      storeHeadMobile: '9000000001',
      email: 'rstest.store@medisync.com',
    },
    update: { cityId: city.id },
  });

  // ── helper to upsert a candidate + its booking ──────────────────────────
  const makeRecord = async (opts: {
    suffix: string;
    name: string;
    mobile: string;
    employeeCode: string;
    appointmentDate: Date;
    scheduledDate: Date;
    reqDate: Date;
  }) => {
    const candidate = await prisma.candidate.upsert({
      where: { candidateId: `CTEST-RS-${opts.suffix}` },
      create: {
        candidateId: `CTEST-RS-${opts.suffix}`,
        storeId: store.id,
        clientId: client.id,
        name: opts.name,
        employeeCode: opts.employeeCode,
        mobile: opts.mobile,
        gender: 'MALE',
        age: 30,
        doj: daysFromNow(-90),
        candidateType: 'NEW_JOINER',
        appointmentDate: opts.appointmentDate,
        pincode: '110001',
        email: `rstest.${opts.suffix.toLowerCase()}@medisync.com`,
        isApproved: true,
      },
      update: {
        storeId: store.id,
        appointmentDate: opts.appointmentDate,
      },
    });

    const booking = await prisma.booking.upsert({
      where: { bookingId: `BTEST-RS-${opts.suffix}` },
      create: {
        bookingId: `BTEST-RS-${opts.suffix}`,
        candidateId: candidate.id,
        clientId: client.id,
        panelId: panel?.id ?? null,
        labId: panel?.labId ?? null,
        reqDate: opts.reqDate,
        scheduledDate: opts.scheduledDate,
        timeSlot: '9:00 AM - 10:00 AM',
        status: 'SCHEDULED',
        amountCharged,
        amountToVendor,
      },
      update: {
        scheduledDate: opts.scheduledDate,
        status: 'SCHEDULED',
        panelId: panel?.id ?? null,
        labId: panel?.labId ?? null,
      },
    });

    return { candidate, booking };
  };

  // ── Record A — past due, NOT yet rescheduled ────────────────────────────
  const a = await makeRecord({
    suffix: 'A',
    name: 'Aarav Sharma (RS Test A)',
    mobile: '9000000010',
    employeeCode: 'RSTESTA',
    appointmentDate: daysFromNow(-5),
    scheduledDate: daysFromNow(-5),
    reqDate: daysFromNow(-12),
  });
  // ensure A has no leftover history from a previous run
  await prisma.bookingScheduleChange.deleteMany({ where: { bookingId: a.booking.id } });

  // ── Record B — already rescheduled (has history), new date in future ────
  const b = await makeRecord({
    suffix: 'B',
    name: 'Vivaan Mehta (RS Test B)',
    mobile: '9000000011',
    employeeCode: 'RSTESTB',
    appointmentDate: daysFromNow(-4),
    scheduledDate: daysFromNow(6),
    reqDate: daysFromNow(-12),
  });
  // exactly one history row → derived status becomes "Rescheduled"
  await prisma.bookingScheduleChange.deleteMany({ where: { bookingId: b.booking.id } });
  await prisma.bookingScheduleChange.create({
    data: {
      bookingId: b.booking.id,
      previousDate: daysFromNow(-4),
      previousTimeSlot: '9:00 AM - 10:00 AM',
      newDate: daysFromNow(6),
      newTimeSlot: '9:00 AM - 10:00 AM',
      reason: 'Client could not attend on the original date.',
      changedBy: client.id,
    },
  });

  console.log('\n✓ Reschedule test fixture ready\n');
  console.log('  Client login : ' + TEST_CLIENT_EMAIL + '  /  ' + TEST_CLIENT_PASSWORD);
  console.log('  Store        : Reschedule Test Store (RSTEST01)');
  console.log('  Panel        : ' + (panel ? panel.name : '(none — booking has no panel)'));
  console.log('\n  Record A (CTEST-RS-A / BTEST-RS-A): SCHEDULED, date 5 days AGO, no history');
  console.log('     → client portal shows "Reschedule"; admin shows no button');
  console.log('  Record B (CTEST-RS-B / BTEST-RS-B): SCHEDULED + 1 reschedule, date 6 days AHEAD');
  console.log('     → admin shows "Reschedule" + "Rescheduled" badge; client shows none\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
