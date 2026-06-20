import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import {
  buildPaginated,
  resolvePagination,
  type PaginationInput,
} from '../../common/pagination/pagination';

@Injectable()
export class ZoneService {
  constructor(private prisma: PrismaService) {}

  // Zones are standalone, global master data — not linked to any client.
  async create(dto: CreateZoneDto, user: { id: string }) {
    return this.prisma.zone.create({
      data: {
        name: dto.name,
        createdBy: user.id,
      },
    });
  }

  async findAll(pagination?: PaginationInput, search?: string) {
    const q = search?.trim();
    const where: any = { deletedAt: null };
    if (q) where.name = { contains: q, mode: 'insensitive' as const };
    const query = {
      where,
      orderBy: { createdAt: 'asc' as const },
      include: { _count: { select: { cities: true } } },
    };
    const { wants, page, limit, skip, take } = resolvePagination(pagination);
    if (!wants) return this.prisma.zone.findMany(query);
    const [items, total] = await Promise.all([
      this.prisma.zone.findMany({ ...query, skip, take }),
      this.prisma.zone.count({ where }),
    ]);
    return buildPaginated(items, total, page, limit);
  }

  async update(id: string, dto: UpdateZoneDto) {
    await this.findZoneOrFail(id);
    return this.prisma.zone.update({ where: { id }, data: dto });
  }

  async remove(id: string, user: { id: string }) {
    await this.findZoneOrFail(id);

    const activeCities = await this.prisma.city.count({
      where: { zoneId: id, deletedAt: null },
    });
    if (activeCities > 0) {
      throw new BadRequestException(
        `Cannot delete zone with ${activeCities} active cities. Remove cities first.`,
      );
    }

    return this.prisma.zone.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: user.id, status: 'INACTIVE' },
    });
  }

  private async findZoneOrFail(id: string) {
    const zone = await this.prisma.zone.findFirst({
      where: { id, deletedAt: null },
    });
    if (!zone) throw new NotFoundException('Zone not found');
    return zone;
  }
}
