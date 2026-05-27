import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { Role } from '../../common/enums/role.enum';

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  mobile: true,
  role: true,
  isActive: true,
  isEmailVerified: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // Clients are users with role USER. Soft-deleted clients are hidden.
  async findClients() {
    return this.prisma.user.findMany({
      where: { role: Role.USER, deletedAt: null },
      select: USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  // Returns the client (role USER, not deleted) or throws.
  private async getClientOrThrow(id: string) {
    const client = await this.prisma.user.findFirst({
      where: { id, role: Role.USER, deletedAt: null },
    });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  // Activate / deactivate a client. Deactivating forces them out: the JWT
  // strategy rejects inactive users on their next request.
  async setActive(id: string, isActive: boolean) {
    await this.getClientOrThrow(id);
    return this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: USER_SELECT,
    });
  }

  // Soft-delete a client: mark deleted and deactivate so they can no longer
  // log in and any active session is rejected on the next request.
  async softDelete(id: string, deletedBy: string) {
    await this.getClientOrThrow(id);
    await this.prisma.user.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date(), deletedBy },
    });
    return { id, deleted: true };
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findMe(id: string) {
    return this.findById(id);
  }

  // Creating a client creates a USER login that can sign in immediately.
  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already in use');

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    return this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        mobile: dto.mobile,
        role: Role.USER,
        isEmailVerified: true,
        isActive: true,
      },
      select: USER_SELECT,
    });
  }
}
