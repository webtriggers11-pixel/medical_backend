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
  // nextVal starts after the current record count so new creates
  // never clash with a future backfill of existing rows.
  const sequenceModules = [
    { prefix: 'B', count: await prisma.booking.count() },
    { prefix: 'S', count: await prisma.store.count() },
    { prefix: 'L', count: await prisma.lab.count() },
    { prefix: 'C', count: await prisma.candidate.count() },
  ];

  for (const { prefix, count } of sequenceModules) {
    await prisma.idSequence.upsert({
      where: { prefix },
      create: { prefix, nextVal: count + 1 },
      update: {}, // never reset an existing counter
    });
    console.log(`✓ IdSequence: ${prefix} → starts at ${count + 1}`);
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

}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
