import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';

@Injectable()
export class ZoneService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateZoneDto, user: { id: string }) {
    return this.prisma.zone.create({
      data: { name: dto.name, createdBy: user.id },
    });
  }

  async findAll() {
    return this.prisma.zone.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      include: { _count: { select: { cities: true } } },
    });
  }

  async update(id: string, dto: UpdateZoneDto, user: { id: string }) {
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
    const zone = await this.prisma.zone.findFirst({ where: { id, deletedAt: null } });
    if (!zone) throw new NotFoundException('Zone not found');
    return zone;
  }
}
