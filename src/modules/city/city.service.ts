import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';

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

  async findAll(zoneId: string) {
    return this.prisma.city.findMany({
      where: { zoneId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { stores: true } } },
    });
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
