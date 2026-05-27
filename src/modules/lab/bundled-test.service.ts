import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBundledTestDto } from './dto/create-bundled-test.dto';
import { UpdateBundledTestDto } from './dto/update-bundled-test.dto';

@Injectable()
export class BundledTestService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateBundledTestDto, userId: string) {
    const lab = await this.prisma.lab.findFirst({
      where: { id: dto.labId, deletedAt: null },
    });
    if (!lab) throw new NotFoundException('Lab not found');

    return this.prisma.labBundledTest.create({
      data: {
        labId: dto.labId,
        name: dto.name,
        testsIncluded: dto.testsIncluded,
        defaultTiming: dto.defaultTiming,
        suggestedMrp: dto.suggestedMrp,
        createdBy: userId,
      },
      include: { lab: { select: { id: true, name: true } } },
    });
  }

  async findAll(labId: string) {
    const lab = await this.prisma.lab.findFirst({
      where: { id: labId, deletedAt: null },
    });
    if (!lab) throw new NotFoundException('Lab not found');

    return this.prisma.labBundledTest.findMany({
      where: { labId, deletedAt: null },
      orderBy: { name: 'asc' },
      include: { _count: { select: { panels: true } } },
    });
  }

  async findOne(id: string) {
    const test = await this.prisma.labBundledTest.findFirst({
      where: { id, deletedAt: null },
      include: {
        lab: { select: { id: true, name: true } },
        panels: { where: { deletedAt: null, status: 'ACTIVE' } },
      },
    });
    if (!test) throw new NotFoundException('Bundled test not found');
    return test;
  }

  async update(id: string, dto: UpdateBundledTestDto) {
    await this.findOne(id);
    return this.prisma.labBundledTest.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    return this.prisma.labBundledTest.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: userId },
    });
  }
}
