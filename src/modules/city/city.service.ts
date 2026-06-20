import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';
import {
  buildPaginated,
  resolvePagination,
  type PaginationInput,
} from '../../common/pagination/pagination';

@Injectable()
export class CityService {
  constructor(private prisma: PrismaService) {}

  // Cities belong to a Zone only — global master data, not client-scoped.
  async create(dto: CreateCityDto, user: { id: string }) {
    const zone = await this.prisma.zone.findFirst({
      where: { id: dto.zoneId, deletedAt: null },
    });
    if (!zone) throw new NotFoundException('Zone not found');

    return this.prisma.city.create({
      data: {
        zoneId: dto.zoneId,
        name: dto.name,
        createdBy: user.id,
      },
    });
  }

  async findAll(zoneId: string, pagination?: PaginationInput, search?: string) {
    const q = search?.trim();
    const where: any = { zoneId, deletedAt: null };
    if (q) where.name = { contains: q, mode: 'insensitive' as const };
    const query = {
      where,
      orderBy: { createdAt: 'asc' as const },
      include: { _count: { select: { stores: true } } },
    };
    const { wants, page, limit, skip, take } = resolvePagination(pagination);
    if (!wants) return this.prisma.city.findMany(query);
    const [items, total] = await Promise.all([
      this.prisma.city.findMany({ ...query, skip, take }),
      this.prisma.city.count({ where }),
    ]);
    return buildPaginated(items, total, page, limit);
  }

  async update(id: string, dto: UpdateCityDto) {
    await this.findCityOrFail(id);
    return this.prisma.city.update({ where: { id }, data: dto });
  }

  async remove(id: string, user: { id: string }) {
    await this.findCityOrFail(id);

    const activeStores = await this.prisma.store.count({
      where: { cityId: id, deletedAt: null },
    });
    if (activeStores > 0) {
      throw new BadRequestException(
        `Cannot delete city with ${activeStores} active stores. Remove stores first.`,
      );
    }

    return this.prisma.city.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: user.id, status: 'INACTIVE' },
    });
  }

  private async findCityOrFail(id: string) {
    const city = await this.prisma.city.findFirst({
      where: { id, deletedAt: null },
    });
    if (!city) throw new NotFoundException('City not found');
    return city;
  }
}
