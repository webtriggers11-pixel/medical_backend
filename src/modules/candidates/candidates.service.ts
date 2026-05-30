import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { CandidateType } from '../../common/enums/candidate.enums';
import {
  buildCandidateTemplate,
  parseCandidateCsv,
  validateRow,
} from './candidate-csv.util';

const CANDIDATE_INCLUDE = {
  store: { select: { id: true, name: true, storeCode: true } },
  client: { select: { id: true, name: true, email: true } },
};

export interface BulkUploadResult {
  created: number;
  skipped: number;
  errors: { row: number; mobile: string; reason: string }[];
}

@Injectable()
export class CandidatesService {
  constructor(private prisma: PrismaService) {}

  findAll(user: { id: string; role: string }) {
    const where: any = { deletedAt: null };
    if (user.role !== 'ADMIN') where.clientId = user.id;
    return this.prisma.candidate.findMany({
      where,
      include: CANDIDATE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateCandidateDto, userId?: string) {
    const store = await this.resolveStore(dto.storeId);

    return this.prisma.candidate.create({
      data: {
        storeId: store.id,
        clientId: store.clientId,
        name: dto.name,
        employeeCode: dto.employeeCode,
        mobile: dto.mobile,
        gender: dto.gender,
        age: dto.age,
        doj: new Date(dto.doj),
        candidateType: dto.candidateType ?? CandidateType.NEW_JOINER,
        pincode: dto.pincode,
        email: dto.email,
        panNumber: dto.panNumber ?? null,
        createdBy: userId,
      },
      include: CANDIDATE_INCLUDE,
    });
  }

  getTemplate(): string {
    return buildCandidateTemplate();
  }

  async bulkCreate(
    fileContent: string,
    userId?: string,
  ): Promise<BulkUploadResult> {
    let rows;
    try {
      rows = parseCandidateCsv(fileContent);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    if (rows.length === 0) {
      throw new BadRequestException('No candidate rows found in the file.');
    }

    const result: BulkUploadResult = { created: 0, skipped: 0, errors: [] };
    const seenMobiles = new Set<string>();
    const storeClientCache = new Map<string, string | null>();

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2; // +1 header, +1 for 1-based
      const validated = validateRow(rows[i]);

      if ('error' in validated) {
        result.skipped++;
        result.errors.push({
          row: rowNumber,
          mobile: rows[i].mobile || '(empty)',
          reason: validated.error,
        });
        continue;
      }

      const c = validated.data;

      if (seenMobiles.has(c.mobile)) {
        result.skipped++;
        result.errors.push({
          row: rowNumber,
          mobile: c.mobile,
          reason: 'Duplicate mobile within file',
        });
        continue;
      }
      seenMobiles.add(c.mobile);

      // Resolve & cache the store's client; skip rows with an unknown store.
      let clientId = storeClientCache.get(c.storeId);
      if (clientId === undefined) {
        const store = await this.prisma.store.findFirst({
          where: { id: c.storeId, deletedAt: null },
          select: { clientId: true },
        });
        clientId = store?.clientId ?? null;
        storeClientCache.set(c.storeId, clientId);
      }
      if (!clientId) {
        result.skipped++;
        result.errors.push({
          row: rowNumber,
          mobile: c.mobile,
          reason: `Unknown storeId "${c.storeId}"`,
        });
        continue;
      }

      await this.prisma.candidate.create({
        data: {
          storeId: c.storeId,
          clientId,
          name: c.name,
          employeeCode: c.employeeCode,
          mobile: c.mobile,
          gender: c.gender,
          age: c.age,
          doj: c.doj,
          candidateType: c.candidateType,
          pincode: c.pincode,
          email: c.email,
          panNumber: c.panNumber,
          createdBy: userId,
        },
      });
      result.created++;
    }

    return result;
  }

  private async resolveStore(storeId: string) {
    const store = await this.prisma.store.findFirst({
      where: { id: storeId, deletedAt: null },
      select: { id: true, clientId: true },
    });
    if (!store) throw new NotFoundException(`Store "${storeId}" not found`);
    return store;
  }
}
