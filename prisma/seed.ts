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

}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
