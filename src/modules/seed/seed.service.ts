import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';

const SEED_USERS = [
  { email: 'superadmin@medisync.com', password: 'SuperAdmin@123', role: 'SUPER_ADMIN' as const },
  { email: 'admin@medisync.com', password: 'Admin@123', role: 'ADMIN' as const },
];

@Injectable()
export class SeedService {
  constructor(private prisma: PrismaService) {}

  async run() {
    const results: { email: string; role: string; action: string }[] = [];

    for (const seed of SEED_USERS) {
      const hashedPassword = await bcrypt.hash(seed.password, 12);

      const existing = await this.prisma.user.findUnique({ where: { email: seed.email } });

      await this.prisma.user.upsert({
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

      results.push({
        email: seed.email,
        role: seed.role,
        action: existing ? 'updated' : 'created',
      });
    }

    return { message: 'Seed completed', users: results };
  }
}
