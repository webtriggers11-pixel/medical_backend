/**
 * Removes the reschedule-flow test fixture created by seed-reschedule-test.ts.
 *
 * Run:  npx ts-node --project tsconfig.json -r tsconfig-paths/register prisma/seed-reschedule-test-cleanup.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

async function main() {
  const bookings = await prisma.booking.findMany({
    where: { bookingId: { in: ['BTEST-RS-A', 'BTEST-RS-B'] } },
    select: { id: true },
  });
  const bookingIds = bookings.map((b) => b.id);

  if (bookingIds.length) {
    await prisma.bookingScheduleChange.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
  }

  await prisma.candidate.deleteMany({ where: { candidateId: { in: ['CTEST-RS-A', 'CTEST-RS-B'] } } });

  const client = await prisma.user.findUnique({ where: { email: 'rstest.client@medisync.com' } });
  if (client) {
    await prisma.clientPanelPricing.deleteMany({ where: { clientId: client.id } });
    await prisma.store.deleteMany({ where: { clientId: client.id, storeCode: 'RSTEST01' } });
    await prisma.user.delete({ where: { id: client.id } });
  }

  console.log('✓ Reschedule test fixture removed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
