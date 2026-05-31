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
import {
  buildPaginated,
  resolvePagination,
  type PaginationInput,
} from '../../common/pagination/pagination';

const CANDIDATE_INCLUDE = {
  store: {
    select: {
      id: true,
      name: true,
      storeCode: true,
      city: {
        select: {
          id: true,
          name: true,
          zone: { select: { id: true, name: true } },
        },
      },
    },
  },
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

  async findAll(
    user: { id: string; role: string },
    pagination?: PaginationInput,
  ) {
    const where: any = { deletedAt: null };
    if (user.role !== 'ADMIN') where.clientId = user.id;
    const query = {
      where,
      include: CANDIDATE_INCLUDE,
      orderBy: { createdAt: 'desc' as const },
    };
    const { wants, page, limit, skip, take } = resolvePagination(pagination);
    if (!wants) return this.prisma.candidate.findMany(query);
    const [items, total] = await Promise.all([
      this.prisma.candidate.findMany({ ...query, skip, take }),
      this.prisma.candidate.count({ where }),
    ]);
    return buildPaginated(items, total, page, limit);
  }

  async create(dto: CreateCandidateDto, userId?: string) {
    const store = await this.resolveStore(dto.storeId);
    const appointmentDate = this.parseFutureAppointment(dto.appointmentDate);

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
        appointmentDate,
        pincode: dto.pincode,
        email: dto.email,
        panNumber: dto.panNumber ?? null,
        createdBy: userId,
      },
      include: CANDIDATE_INCLUDE,
    });
  }

  async setApproval(id: string, isApproved: boolean) {
    return this.prisma.candidate.update({
      where: { id },
      data: { isApproved },
      include: {
        store: { select: { id: true, name: true, storeCode: true } },
        client: { select: { id: true, name: true, email: true } },
      },
    });
  }

  getTemplate(): string {
    return buildCandidateTemplate();
  }

  async bulkCreate(
    fileContent: string,
    storeId: string,
    user?: { id: string; role: string },
  ): Promise<BulkUploadResult> {
    const userId = user?.id;

    if (!storeId?.trim()) {
      throw new BadRequestException('Please select a store before uploading.');
    }

    // The store is picked from a dropdown — resolve it once, scoped to the
    // uploading client, so every candidate is assigned to that store & client.
    const store = await this.prisma.store.findFirst({
      where: { id: storeId, clientId: userId, deletedAt: null },
      select: { id: true, clientId: true },
    });
    if (!store) {
      throw new BadRequestException(
        'Selected store was not found for your account.',
      );
    }

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

      await this.prisma.candidate.create({
        data: {
          storeId: store.id,
          clientId: store.clientId,
          name: c.name,
          employeeCode: c.employeeCode,
          mobile: c.mobile,
          gender: c.gender,
          age: c.age,
          doj: c.doj,
          candidateType: c.candidateType,
          appointmentDate: c.appointmentDate,
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

  /**
   * Validate that an appointment date is today's date or later (no past
   * bookings). Returns a Date at UTC midnight.
   */
  private parseFutureAppointment(value: string): Date {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('appointmentDate must be a valid date');
    }
    const apptDay = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    const now = new Date();
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    if (apptDay <= today) {
      throw new BadRequestException('appointmentDate must be a future date');
    }
    return apptDay;
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
