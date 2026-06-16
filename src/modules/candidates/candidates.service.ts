import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IdSequenceService } from '../../common/id-sequence/id-sequence.service';
import { CreateCandidateDto } from './dto/create-candidate.dto';
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
      address: true,
      storeHeadName: true,
      storeHeadMobile: true,
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
  constructor(
    private prisma: PrismaService,
    private idSeq: IdSequenceService,
  ) {}

  async findAll(
    user: { id: string; role: string },
    filters: {
      clientId?: string;
      storeId?: string;
      availableForBooking?: boolean;
      search?: string;
    } = {},
    pagination?: PaginationInput,
  ) {
    const where: any = { deletedAt: null };
    // USER is locked to its own client; ADMIN may scope by clientId.
    if (user.role !== 'ADMIN') {
      where.clientId = user.id;
    } else if (filters.clientId) {
      where.clientId = filters.clientId;
    }
    if (filters.storeId) where.storeId = filters.storeId;
    // Free-text search across name / employee code / email / mobile.
    const search = filters.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { employeeCode: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
        { mobile: { contains: search } },
      ];
    }
    // "Requested" candidates: active, have an appointment, and not yet booked
    // (no active/non-cancelled booking).
    if (filters.availableForBooking) {
      where.isActive = true;
      where.appointmentDate = { not: null };
      where.bookings = {
        none: { status: { notIn: ['CANCELLED'] }, deletedAt: null },
      };
    }
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

    // mobile, employeeCode and pincode are not unique — duplicates are allowed.
    return this.prisma.$transaction(async (tx) => {
      const candidateId = await this.idSeq.generate('C', tx);
      return tx.candidate.create({
        data: {
          candidateId,
          storeId: store.id,
          clientId: store.clientId,
          name: dto.name,
          employeeCode: dto.employeeCode ?? null,
          mobile: dto.mobile,
          gender: dto.gender,
          age: dto.age,
          doj: new Date(dto.doj),
          candidateType: dto.candidateType,
          appointmentDate,
          pincode: dto.pincode,
          email: dto.email ?? null,
          panNumber: dto.panNumber ?? null,
          createdBy: userId,
        },
        include: CANDIDATE_INCLUDE,
      });
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

  async getTemplate(user: { id: string; role: string }): Promise<string> {
    // Pre-fill the template with the uploader's stores so they can copy the
    // correct storeId (and see its zone/city) into each candidate row.
    const where: any = { deletedAt: null };
    if (user.role !== 'ADMIN') where.clientId = user.id;
    const stores = await this.prisma.store.findMany({
      where,
      select: {
        id: true,
        city: { select: { name: true, zone: { select: { name: true } } } },
      },
      orderBy: { name: 'asc' as const },
    });
    return buildCandidateTemplate(
      stores.map((s) => ({
        zone: s.city?.zone?.name ?? '',
        city: s.city?.name ?? '',
        storeId: s.id,
      })),
    );
  }

  async bulkCreate(
    fileContent: string,
    user?: { id: string; role: string },
  ): Promise<BulkUploadResult> {
    const userId = user?.id;

    // The store is chosen per row via the storeId column. Load the uploader's
    // stores once so each row can be resolved (and scoped to their account).
    const storeWhere: any = { deletedAt: null };
    if (user?.role !== 'ADMIN') storeWhere.clientId = userId;
    const stores = await this.prisma.store.findMany({
      where: storeWhere,
      select: { id: true, clientId: true },
    });
    const storeMap = new Map(stores.map((s) => [s.id, s]));

    let rows;
    try {
      rows = parseCandidateCsv(fileContent);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    if (rows.length === 0) {
      throw new BadRequestException('No candidate rows found in the file.');
    }

    // Mobile, employeeCode and pincode are not unique — duplicates are allowed,
    // both within the file and against existing candidates.
    const result: BulkUploadResult = { created: 0, skipped: 0, errors: [] };

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

      const store = storeMap.get(c.storeId);
      if (!store) {
        result.skipped++;
        result.errors.push({
          row: rowNumber,
          mobile: c.mobile,
          reason: `storeId "${c.storeId}" not found for your account`,
        });
        continue;
      }

      await this.prisma.$transaction(async (tx) => {
        const candidateId = await this.idSeq.generate('C', tx);
        await tx.candidate.create({
          data: {
            candidateId,
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
