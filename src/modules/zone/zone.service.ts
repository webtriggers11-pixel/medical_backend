import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class ZoneService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateZoneDto, user: { sub: string; role: string; companyId?: string }) {
    await this.assertCompanyAccess(dto.companyId, user);

    return this.prisma.zone.create({
      data: {
        companyId: dto.companyId,
        name: dto.name,
        createdBy: user.sub,
      },
    });
  }

  async findAll(
    companyId: string,
    user: { sub: string; role: string; companyId?: string },
  ) {
    await this.assertCompanyAccess(companyId, user);

    return this.prisma.zone.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { cities: true } } },
    });
  }

  async update(
    id: string,
    dto: UpdateZoneDto,
    user: { sub: string; role: string; companyId?: string },
  ) {
    const zone = await this.findZoneOrFail(id);
    await this.assertCompanyAccess(zone.companyId, user);

    return this.prisma.zone.update({ where: { id }, data: dto });
  }

  async remove(id: string, user: { sub: string; role: string; companyId?: string }) {
    const zone = await this.findZoneOrFail(id);
    await this.assertCompanyAccess(zone.companyId, user);

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
      data: { deletedAt: new Date(), deletedBy: user.sub, status: 'INACTIVE' },
    });
  }

  private async findZoneOrFail(id: string) {
    const zone = await this.prisma.zone.findFirst({ where: { id, deletedAt: null } });
    if (!zone) throw new NotFoundException('Zone not found');
    return zone;
  }

  private async assertCompanyAccess(
    companyId: string,
    user: { sub: string; role: string; companyId?: string },
  ) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
    });
    if (!company) throw new NotFoundException('Company not found');

    if (user.role !== Role.SUPER_ADMIN && companyId !== user.companyId) {
      throw new ForbiddenException('Access denied');
    }
  }
}
