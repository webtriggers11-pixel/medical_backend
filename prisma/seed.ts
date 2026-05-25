import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

const seeds = [
  {
    email: 'superadmin@medisync.com',
    password: 'SuperAdmin@123',
    role: 'SUPER_ADMIN' as const,
  },
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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
