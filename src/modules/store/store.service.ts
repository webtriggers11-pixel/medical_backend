import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { Role } from '../../common/enums/role.enum';
import {
  buildPaginated,
  resolvePagination,
  type PaginationInput,
} from '../../common/pagination/pagination';

@Injectable()
export class StoreService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateStoreDto, user: { id: string; role: string }) {
    const city = await this.prisma.city.findFirst({
      where: { id: dto.cityId, deletedAt: null },
    });
    if (!city) throw new NotFoundException('City not found');

    // Admin can create a store on behalf of any client by passing clientId.
    // A USER always owns the store themselves.
    let clientId: string;
    if (user.role === Role.ADMIN && dto.clientId) {
      const client = await this.prisma.user.findFirst({
        where: { id: dto.clientId, role: 'USER', deletedAt: null },
      });
      if (!client)
        throw new BadRequestException(
          'Client not found or not a valid client account',
        );
      clientId = dto.clientId;
    } else {
      clientId = user.id;
    }

    const duplicate = await this.prisma.store.findFirst({
      where: { clientId, storeCode: dto.storeCode, deletedAt: null },
    });
    if (duplicate) {
      throw new ConflictException(
        `Store code "${dto.storeCode}" already exists`,
      );
    }

    return this.prisma.store.create({
      data: {
        clientId,
        cityId: dto.cityId,
        storeCode: dto.storeCode,
        name: dto.name,
        address: dto.address,
        storeHeadName: dto.storeHeadName,
        storeHeadMobile: dto.storeHeadMobile,
        email: dto.email,
        storeContact: dto.storeContact,
        storeAsstHeadName: dto.storeAsstHeadName,
        storeAsstHeadMobile: dto.storeAsstHeadMobile,
        createdBy: user.id,
      },
      include: { city: { select: { name: true } } },
    });
  }

  // Lists the client's own stores. ADMINs see all stores.
  // Optional zone/city filters narrow the result; cities live under zones.
  async findAll(
    user: { id: string; role: string },
    filters: { cityId?: string; zoneId?: string } = {},
    pagination?: PaginationInput,
  ) {
    const where: Prisma.StoreWhereInput = { deletedAt: null };

    if (user.role !== Role.ADMIN) {
      where.clientId = user.id;
    }
    if (filters.cityId) where.cityId = filters.cityId;
    if (filters.zoneId) where.city = { zoneId: filters.zoneId };

    const query = {
      where,
      orderBy: { createdAt: 'desc' as const },
      include: {
        city: {
          select: {
            id: true,
            name: true,
            zoneId: true,
            zone: { select: { id: true, name: true } },
          },
        },
        client: { select: { id: true, name: true, email: true } },
        _count: { select: { candidates: true } },
      },
    };
    const { wants, page, limit, skip, take } = resolvePagination(pagination);
    if (!wants) return this.prisma.store.findMany(query);
    const [items, total] = await Promise.all([
      this.prisma.store.findMany({ ...query, skip, take }),
      this.prisma.store.count({ where }),
    ]);
    return buildPaginated(items, total, page, limit);
  }

  async findOne(id: string, user: { id: string; role: string }) {
    const store = await this.prisma.store.findFirst({
      where: { id, deletedAt: null },
      include: {
        city: { select: { name: true } },
        _count: { select: { candidates: true } },
      },
    });
    if (!store) throw new NotFoundException('Store not found');

    this.assertClientAccess(store.clientId, user);
    return store;
  }

  async update(
    id: string,
    dto: UpdateStoreDto,
    user: { id: string; role: string },
  ) {
    const store = await this.findStoreOrFail(id);
    this.assertClientAccess(store.clientId, user);

    return this.prisma.store.update({ where: { id }, data: dto });
  }

  async remove(id: string, user: { id: string; role: string }) {
    const store = await this.findStoreOrFail(id);
    this.assertClientAccess(store.clientId, user);

    return this.prisma.store.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: user.id, status: 'INACTIVE' },
    });
  }

  private async findStoreOrFail(id: string) {
    const store = await this.prisma.store.findFirst({
      where: { id, deletedAt: null },
    });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  private assertClientAccess(
    clientId: string,
    user: { id: string; role: string },
  ) {
    if (user.role !== Role.ADMIN && clientId !== user.id) {
      throw new ForbiddenException('Access denied');
    }
  }
}
