import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTestMasterDto } from './dto/create-test-master.dto';
import { UpdateTestMasterDto } from './dto/update-test-master.dto';

@Injectable()
export class TestMasterService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.testMaster.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const test = await this.prisma.testMaster.findFirst({
      where: { id, deletedAt: null },
    });
    if (!test) throw new NotFoundException('Test not found');
    return test;
  }

  async create(dto: CreateTestMasterDto, userId: string) {
    const existing = await this.prisma.testMaster.findFirst({
      where: { name: dto.name, deletedAt: null },
    });
    if (existing) throw new ConflictException('A test with this name already exists');

    return this.prisma.testMaster.create({
      data: {
        name: dto.name,
        description: dto.description,
        status: dto.status ?? 'ACTIVE',
        createdBy: userId,
      },
    });
  }

  async update(id: string, dto: UpdateTestMasterDto) {
    await this.findOne(id);
    return this.prisma.testMaster.update({
      where: { id },
      data: dto,
    });
  }

  async softDelete(id: string, userId: string) {
    await this.findOne(id);
    await this.prisma.testMaster.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: userId },
    });
    return { id, deleted: true };
  }
}
