import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

const seeds = [
  {
    email: 'admin@medisync.com',
    password: 'Admin@123',
    role: 'ADMIN' as const,
  },
];

async function main() {
  for (const seed of seeds) {
    const hashedPassword = await bcrypt.hash(seed.password, 12);

    const user = await prisma.user.upsert({
      where: { email: seed.email },
      create: {
        email: seed.email,
        password: hashedPassword,
        name: 'Admin',
        role: seed.role,
        isEmailVerified: true,
        isActive: true,
      },
      update: {
        password: hashedPassword,
        role: seed.role,
        isEmailVerified: true,
        isActive: true,
      },
    });

    console.log(`✓ ${user.role}: ${user.email}`);
  }

  // Standalone master data — zones with their cities.
  const zoneSeed: { name: string; cities: string[] }[] = [
    {
      name: 'North',
      cities: ['Delhi', 'Jaipur', 'Lucknow', 'Chandigarh', 'Amritsar', 'Ludhiana', 'Kanpur', 'Agra', 'Srinagar', 'Dehradun', 'Shimla', 'Gurugram', 'Noida'],
    },
    {
      name: 'South',
      cities: ['Bengaluru', 'Chennai', 'Hyderabad', 'Kochi', 'Coimbatore', 'Visakhapatnam', 'Vijayawada', 'Mysuru', 'Thiruvananthapuram', 'Madurai', 'Mangaluru'],
    },
    {
      name: 'East',
      cities: ['Kolkata', 'Patna', 'Ranchi', 'Bhubaneswar', 'Jamshedpur', 'Cuttack', 'Dhanbad', 'Gaya', 'Durgapur'],
    },
    {
      name: 'West',
      cities: ['Mumbai', 'Pune', 'Ahmedabad', 'Surat', 'Nagpur', 'Nashik', 'Vadodara', 'Rajkot', 'Panaji', 'Thane', 'Kalyan-Dombivli'],
    },
    {
      name: 'Central',
      cities: ['Bhopal', 'Indore', 'Raipur', 'Gwalior', 'Jabalpur', 'Bhilai', 'Ujjain'],
    },
    {
      name: 'North-East',
      cities: ['Guwahati', 'Shillong', 'Imphal', 'Agartala', 'Aizawl', 'Kohima', 'Itanagar', 'Gangtok', 'Dibrugarh'],
    },
  ];

  for (const z of zoneSeed) {
    // Zones/cities have no unique name, so find-or-create to keep seeding idempotent.
    let zone = await prisma.zone.findFirst({
      where: { name: z.name, deletedAt: null },
    });
    if (!zone) {
      zone = await prisma.zone.create({ data: { name: z.name } });
    }

    for (const cityName of z.cities) {
      const existing = await prisma.city.findFirst({
        where: { name: cityName, zoneId: zone.id, deletedAt: null },
      });
      if (!existing) {
        await prisma.city.create({ data: { name: cityName, zoneId: zone.id } });
      }
    }

    console.log(`✓ Zone: ${z.name} (${z.cities.length} cities)`);
  }

  // ID sequence counters — one row per module prefix.
  // Each prefix starts at 1000000 so first generate() returns 1000001.
  const sequencePrefixes = ['B', 'S', 'L', 'C', 'CL', 'P', 'T'];

  for (const prefix of sequencePrefixes) {
    await prisma.idSequence.upsert({
      where: { prefix },
      create: { prefix, nextVal: 1000000 },
      update: {}, // never reset an existing counter
    });
    console.log(`✓ IdSequence: ${prefix} → starts at 1000000`);
  }

  // Test Master seed — global diagnostic test catalog.
  const testMasterSeed: { name: string; description: string }[] = [
    {
      name: 'Complete Blood Count (CBC)',
      description: 'Measures red blood cells, white blood cells, platelets, hemoglobin, and other blood components.',
    },
    {
      name: 'Liver Function Test (LFT)',
      description: 'Evaluates liver health by measuring enzymes, proteins, and bilirubin levels.',
    },
    {
      name: 'Kidney Function Test (KFT)',
      description: 'Assesses kidney performance using creatinine, urea, and other markers.',
    },
    {
      name: 'Lipid Profile',
      description: 'Measures cholesterol and triglyceride levels to assess cardiovascular health.',
    },
    {
      name: 'HbA1c',
      description: 'Indicates average blood sugar levels over the last 2–3 months and helps monitor diabetes.',
    },
    {
      name: 'Thyroid Profile (T3, T4, TSH)',
      description: 'Evaluates thyroid gland function and hormone levels.',
    },
    {
      name: 'Vitamin D Test',
      description: 'Measures Vitamin D levels to assess bone health and deficiency.',
    },
    {
      name: 'Vitamin B12 Test',
      description: 'Measures Vitamin B12 levels and helps diagnose nutritional deficiencies.',
    },
    {
      name: 'Blood Sugar Fasting (FBS)',
      description: 'Measures fasting blood glucose levels for diabetes screening.',
    },
    {
      name: 'Blood Sugar Postprandial (PPBS)',
      description: 'Measures blood glucose levels after a meal.',
    },
    {
      name: 'C-Reactive Protein (CRP)',
      description: 'Detects inflammation and infection in the body.',
    },
    {
      name: 'Uric Acid Test',
      description: 'Measures uric acid levels to assess gout and kidney-related conditions.',
    },
    {
      name: 'Urine Routine Examination',
      description: 'Analyzes urine for infections, kidney disorders, and other abnormalities.',
    },
    {
      name: 'Dengue NS1 Antigen Test',
      description: 'Detects dengue infection during the early stages of illness.',
    },
    {
      name: 'HIV 1 & 2 Test',
      description: 'Screens for Human Immunodeficiency Virus (HIV) infection.',
    },
  ];

  for (const t of testMasterSeed) {
    const existing = await prisma.testMaster.findFirst({
      where: { name: t.name, deletedAt: null },
    });
    if (!existing) {
      await prisma.testMaster.create({
        data: { name: t.name, description: t.description, status: 'ACTIVE' },
      });
    }
    console.log(`✓ TestMaster: ${t.name}`);
  }

  // ── Display-ID backfill ─────────────────────────────────────────
  // Idempotent: reformats legacy ids (C001 → C-0000001) preserving their
  // numbers, assigns ids to rows that have none (oldest first), and bumps
  // each counter to the highest number in use (never decreases it).
  const fmtId = (_prefix: string, n: number) => String(n);
  const NEW_FORMAT = /^\d{7,}$/;

  const displayIdTargets: {
    prefix: string;
    label: string;
    model: any;
    field: string;
    where?: Record<string, unknown>;
  }[] = [
    { prefix: 'CL', label: 'Client', model: prisma.user, field: 'clientId', where: { role: 'USER' } },
    { prefix: 'C', label: 'Candidate', model: prisma.candidate, field: 'candidateId' },
    { prefix: 'S', label: 'Store', model: prisma.store, field: 'storeId' },
    { prefix: 'P', label: 'Panel', model: prisma.panel, field: 'panelId' },
    { prefix: 'T', label: 'Test', model: prisma.testMaster, field: 'testId' },
    { prefix: 'L', label: 'Lab', model: prisma.lab, field: 'labId' },
    { prefix: 'B', label: 'Booking', model: prisma.booking, field: 'bookingId' },
  ];

  for (const target of displayIdTargets) {
    const { prefix, label, model, field } = target;
    const where = target.where ?? {};

    const withId = await model.findMany({
      where: { ...where, [field]: { not: null } },
      select: { id: true, [field]: true },
      orderBy: { createdAt: 'asc' },
    });

    // Numbers already taken by correctly-formatted ids — reformatting a
    // legacy id into one of these would violate the unique index.
    const usedNumbers = new Set<number>();
    let maxNum = 0;
    for (const row of withId) {
      const current = row[field] as string;
      if (NEW_FORMAT.test(current)) {
        const num = parseInt(current.replace(/\D/g, ''), 10) || 0;
        usedNumbers.add(num);
        maxNum = Math.max(maxNum, num);
      }
    }

    // Reformat legacy ids, keeping their number when it's free; rows whose
    // number is already taken are deferred and renumbered like blank rows.
    const deferred: { id: string }[] = [];
    let reformatted = 0;
    for (const row of withId) {
      const current = row[field] as string;
      if (NEW_FORMAT.test(current)) continue;
      const num = parseInt(current.replace(/\D/g, ''), 10) || 0;
      if (num > 0 && !usedNumbers.has(num)) {
        await model.update({
          where: { id: row.id },
          data: { [field]: fmtId(prefix, num) },
        });
        usedNumbers.add(num);
        maxNum = Math.max(maxNum, num);
        reformatted++;
      } else {
        deferred.push({ id: row.id });
      }
    }

    // Assign ids to rows that have none (oldest first), continuing after
    // both the highest number in use and the current counter.
    const seq = await prisma.idSequence.findUnique({ where: { prefix } });
    let lastUsed = Math.max(maxNum, Number(seq?.nextVal ?? 0));
    const blank = await model.findMany({
      where: { ...where, [field]: null },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    for (const row of [...deferred, ...blank]) {
      do {
        lastUsed += 1;
      } while (usedNumbers.has(lastUsed));
      usedNumbers.add(lastUsed);
      await model.update({
        where: { id: row.id },
        data: { [field]: fmtId(prefix, lastUsed) },
      });
    }

    // generate() increments before use, so the stored counter is the
    // last used number. lastUsed only ever grows, so this never rewinds.
    await prisma.idSequence.upsert({
      where: { prefix },
      create: { prefix, nextVal: lastUsed },
      update: { nextVal: lastUsed },
    });
    console.log(
      `✓ ${label} ids (${prefix}): ${reformatted} reformatted, ${deferred.length + blank.length} assigned, counter at ${lastUsed}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
