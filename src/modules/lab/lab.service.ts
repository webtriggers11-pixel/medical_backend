import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IdSequenceService } from '../../common/id-sequence/id-sequence.service';
import { CreateLabDto } from './dto/create-lab.dto';
import { UpdateLabDto } from './dto/update-lab.dto';
import {
  buildPaginated,
  resolvePagination,
  type PaginationInput,
} from '../../common/pagination/pagination';

@Injectable()
export class LabService {
  constructor(
    private prisma: PrismaService,
    private idSeq: IdSequenceService,
  ) {}

  async create(dto: CreateLabDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const labId = await this.idSeq.generate('L', tx);
      return tx.lab.create({
        data: {
          labId,
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
    });
  }

  async findAll(
    cityId?: string,
    pagination?: PaginationInput,
    search?: string,
  ) {
    const where: any = { deletedAt: null };

    if (cityId) {
      where.serviceCities = { path: '$', array_contains: cityId };
    }
    const q = search?.trim();
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' as const } },
        { email: { contains: q, mode: 'insensitive' as const } },
        { contactName: { contains: q, mode: 'insensitive' as const } },
        { labId: { contains: q } },
      ];
    }

    const query = {
      where,
      orderBy: { name: 'asc' as const },
      include: { _count: { select: { panels: true } } },
    };
    const { wants, page, limit, skip, take } = resolvePagination(pagination);
    if (!wants) return this.prisma.lab.findMany(query);
    const [items, total] = await Promise.all([
      this.prisma.lab.findMany({ ...query, skip, take }),
      this.prisma.lab.count({ where }),
    ]);
    return buildPaginated(items, total, page, limit);
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
