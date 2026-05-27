import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class StoreService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateStoreDto, user: { id: string; role: string; companyId?: string }) {
    await this.assertCompanyAccess(dto.companyId, user);

    const city = await this.prisma.city.findFirst({
      where: { id: dto.cityId, deletedAt: null },
    });
    if (!city) throw new NotFoundException('City not found');

    const duplicate = await this.prisma.store.findFirst({
      where: { companyId: dto.companyId, storeCode: dto.storeCode, deletedAt: null },
    });
    if (duplicate) {
      throw new ConflictException(`Store code "${dto.storeCode}" already exists in this company`);
    }

    return this.prisma.store.create({
      data: {
        companyId: dto.companyId,
        cityId: dto.cityId,
        storeCode: dto.storeCode,
        name: dto.name,
        address: dto.address,
        storeHeadName: dto.storeHeadName,
        storeHeadMobile: dto.storeHeadMobile,
        email: dto.email,
        createdBy: user.id,
      },
      include: { city: { select: { name: true } } },
    });
  }

  async findAll(
    cityId: string,
    user: { id: string; role: string; companyId?: string },
  ) {
    const city = await this.prisma.city.findFirst({
      where: { id: cityId, deletedAt: null },
    });
    if (!city) throw new NotFoundException('City not found');

    return this.prisma.store.findMany({
      where: { cityId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: {
        city: { select: { name: true } },
        _count: { select: { candidates: true } },
      },
    });
  }

  async findOne(id: string, user: { id: string; role: string; companyId?: string }) {
    const store = await this.prisma.store.findFirst({
      where: { id, deletedAt: null },
      include: {
        city: { select: { name: true } },
        _count: { select: { candidates: true } },
      },
    });
    if (!store) throw new NotFoundException('Store not found');

    await this.assertCompanyAccess(store.companyId, user);
    return store;
  }

  async update(
    id: string,
    dto: UpdateStoreDto,
    user: { id: string; role: string; companyId?: string },
  ) {
    const store = await this.findStoreOrFail(id);
    await this.assertCompanyAccess(store.companyId, user);

    return this.prisma.store.update({ where: { id }, data: dto });
  }

  async remove(id: string, user: { id: string; role: string; companyId?: string }) {
    const store = await this.findStoreOrFail(id);
    await this.assertCompanyAccess(store.companyId, user);

    return this.prisma.store.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: user.id, status: 'INACTIVE' },
    });
  }

  private async findStoreOrFail(id: string) {
    const store = await this.prisma.store.findFirst({ where: { id, deletedAt: null } });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  private async assertCompanyAccess(
    companyId: string,
    user: { id: string; role: string; companyId?: string },
  ) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
    });
    if (!company) throw new NotFoundException('Company not found');

    if (user.role !== Role.ADMIN && companyId !== user.companyId) {
      throw new ForbiddenException('Access denied');
    }
  }
}
