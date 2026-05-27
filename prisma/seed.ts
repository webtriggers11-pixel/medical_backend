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
  {
    email: 'user@medisync.com',
    password: 'User@123',
    role: 'USER' as const,
  },
];

async function main() {
  // The seeded client (a USER) owns the demo stores below.
  let clientId = '';

  for (const seed of seeds) {
    const hashedPassword = await bcrypt.hash(seed.password, 12);

    const user = await prisma.user.upsert({
      where: { email: seed.email },
      create: {
        email: seed.email,
        password: hashedPassword,
        name: seed.role === 'USER' ? 'Demo Client' : 'Admin',
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

    if (user.role === 'USER') clientId = user.id;
    console.log(`✓ ${user.role}: ${user.email}`);
  }

  // Standalone master data — zones with their cities (for testing).
  const zoneSeed: { name: string; cities: string[] }[] = [
    { name: 'North', cities: ['Delhi', 'Chandigarh', 'Jaipur', 'Lucknow'] },
    { name: 'West', cities: ['Mumbai', 'Pune', 'Ahmedabad', 'Surat'] },
    { name: 'South', cities: ['Bengaluru', 'Chennai', 'Hyderabad', 'Kochi'] },
    { name: 'East', cities: ['Kolkata', 'Bhubaneswar', 'Guwahati', 'Patna'] },
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

  // Demo stores for the default client so the seeded USER sees data on login.
  const storeSeed = [
    { storeCode: 'DEL-001', name: 'Delhi Central', cityName: 'Delhi', head: 'Rahul Sharma', mobile: '9810000001' },
    { storeCode: 'MUM-001', name: 'Andheri Branch', cityName: 'Mumbai', head: 'Priya Patel', mobile: '9820000002' },
    { storeCode: 'BLR-001', name: 'Koramangala', cityName: 'Bengaluru', head: 'Arjun Rao', mobile: '9830000003' },
    { storeCode: 'KOL-001', name: 'Salt Lake', cityName: 'Kolkata', head: 'Sneha Das', mobile: '9840000004' },
  ];

  for (const s of storeSeed) {
    const city = await prisma.city.findFirst({
      where: { name: s.cityName, deletedAt: null },
    });
    if (!city) continue;

    // Stores are unique per [clientId, storeCode] — find-or-create to stay idempotent.
    const existing = await prisma.store.findFirst({
      where: { clientId, storeCode: s.storeCode, deletedAt: null },
    });
    if (!existing) {
      await prisma.store.create({
        data: {
          clientId,
          cityId: city.id,
          storeCode: s.storeCode,
          name: s.name,
          address: `${s.cityName} main road`,
          storeHeadName: s.head,
          storeHeadMobile: s.mobile,
        },
      });
    }
    console.log(`✓ Store: ${s.name} (${s.cityName})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
