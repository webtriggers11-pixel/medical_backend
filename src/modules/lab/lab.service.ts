import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLabDto } from './dto/create-lab.dto';
import { UpdateLabDto } from './dto/update-lab.dto';

@Injectable()
export class LabService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateLabDto, userId: string) {
    return this.prisma.lab.create({
      data: {
        name: dto.name,
        contactName: dto.contactName,
        contactMobile: dto.contactMobile,
        email: dto.email,
        address: dto.address,
        pincode: dto.pincode,
        serviceCities: dto.serviceCities ?? [],
        createdBy: userId,
      },
    });
  }

  async findAll(cityId?: string) {
    const where: any = { deletedAt: null, status: 'ACTIVE' };

    if (cityId) {
      where.serviceCities = { path: '$', array_contains: cityId };
    }

    return this.prisma.lab.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      include: { _count: { select: { panels: true } } },
    });
  }

  async findOne(id: string) {
    const lab = await this.prisma.lab.findFirst({
      where: { id, deletedAt: null },
      include: {
        panels: { where: { deletedAt: null, status: 'ACTIVE' } },
        _count: { select: { panels: true, bundledTests: true } },
      },
    });
    if (!lab) throw new NotFoundException('Lab not found');
    return lab;
  }

  async update(id: string, dto: UpdateLabDto, userId: string) {
    await this.findOne(id);
    return this.prisma.lab.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.serviceCities !== undefined && {
          serviceCities: dto.serviceCities,
        }),
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    return this.prisma.lab.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: userId, status: 'INACTIVE' },
    });
  }
}
