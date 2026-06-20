import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IdSequenceService } from '../../common/id-sequence/id-sequence.service';
import { CreateTestMasterDto } from './dto/create-test-master.dto';
import { UpdateTestMasterDto } from './dto/update-test-master.dto';
import {
  buildPaginated,
  resolvePagination,
  type PaginationInput,
} from '../../common/pagination/pagination';

@Injectable()
export class TestMasterService {
  constructor(
    private prisma: PrismaService,
    private idSeq: IdSequenceService,
  ) {}

  async findAll(pagination?: PaginationInput, search?: string) {
    const q = search?.trim();
    const where: any = { deletedAt: null };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' as const } },
        { description: { contains: q, mode: 'insensitive' as const } },
        { testId: { contains: q } },
      ];
    }
    const query = { where, orderBy: { createdAt: 'desc' as const } };
    const { wants, page, limit, skip, take } = resolvePagination(pagination);
    if (!wants) return this.prisma.testMaster.findMany(query);
    const [items, total] = await Promise.all([
      this.prisma.testMaster.findMany({ ...query, skip, take }),
      this.prisma.testMaster.count({ where }),
    ]);
    return buildPaginated(items, total, page, limit);
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
    if (existing)
      throw new ConflictException('A test with this name already exists');

    return this.prisma.$transaction(async (tx) => {
      const testId = await this.idSeq.generate('T', tx);
      return tx.testMaster.create({
        data: {
          testId,
          name: dto.name,
          description: dto.description,
          status: dto.status ?? 'ACTIVE',
          createdBy: userId,
        },
      });
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
