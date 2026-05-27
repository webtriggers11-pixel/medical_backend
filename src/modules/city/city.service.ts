import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class CityService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCityDto, user: { sub: string; role: string; companyId?: string }) {
    await this.assertCompanyAccess(dto.companyId, user);

    const zone = await this.prisma.zone.findFirst({
      where: { id: dto.zoneId, companyId: dto.companyId, deletedAt: null },
    });
    if (!zone) throw new NotFoundException('Zone not found in this company');

    return this.prisma.city.create({
      data: {
        companyId: dto.companyId,
        zoneId: dto.zoneId,
        name: dto.name,
        createdBy: user.sub,
      },
    });
  }

  async findAll(
    zoneId: string,
    user: { sub: string; role: string; companyId?: string },
  ) {
    const zone = await this.prisma.zone.findFirst({
      where: { id: zoneId, deletedAt: null },
    });
    if (!zone) throw new NotFoundException('Zone not found');

    await this.assertCompanyAccess(zone.companyId, user);

    return this.prisma.city.findMany({
      where: { zoneId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { stores: true } } },
    });
  }

  async update(
    id: string,
    dto: UpdateCityDto,
    user: { sub: string; role: string; companyId?: string },
  ) {
    const city = await this.findCityOrFail(id);
    await this.assertCompanyAccess(city.companyId, user);

    return this.prisma.city.update({ where: { id }, data: dto });
  }

  async remove(id: string, user: { sub: string; role: string; companyId?: string }) {
    const city = await this.findCityOrFail(id);
    await this.assertCompanyAccess(city.companyId, user);

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
      data: { deletedAt: new Date(), deletedBy: user.sub, status: 'INACTIVE' },
    });
  }

  private async findCityOrFail(id: string) {
    const city = await this.prisma.city.findFirst({ where: { id, deletedAt: null } });
    if (!city) throw new NotFoundException('City not found');
    return city;
  }

  private async assertCompanyAccess(
    companyId: string,
    user: { sub: string; role: string; companyId?: string },
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
