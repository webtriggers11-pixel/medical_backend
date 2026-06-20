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
      zoneId?: string;
      cityId?: string;
      labId?: string;
      isApproved?: boolean;
      statusBucket?: string;
      appointmentFrom?: string;
      appointmentTo?: string;
      availableForBooking?: boolean;
      search?: string;
      candidateType?: string;
    } = {},
    pagination?: PaginationInput,
    withRel?: { booking?: boolean; reports?: boolean },
  ) {
    const where: any = { deletedAt: null };
    // USER is locked to its own client; ADMIN may scope by clientId.
    if (user.role !== 'ADMIN') {
      where.clientId = user.id;
    } else if (filters.clientId) {
      where.clientId = filters.clientId;
    }
    if (filters.storeId) where.storeId = filters.storeId;
    if (filters.candidateType) where.candidateType = filters.candidateType;
    if (filters.isApproved !== undefined) where.isApproved = filters.isApproved;

    // Store hierarchy (zone / city) via the store relation.
    const storeFilter: any = {};
    if (filters.cityId) storeFilter.cityId = filters.cityId;
    if (filters.zoneId) storeFilter.city = { is: { zoneId: filters.zoneId } };
    if (Object.keys(storeFilter).length) where.store = { is: storeFilter };

    // Appointment-date range (dashboard date filter).
    if (filters.appointmentFrom || filters.appointmentTo) {
      where.appointmentDate = {};
      if (filters.appointmentFrom)
        where.appointmentDate.gte = new Date(filters.appointmentFrom);
      if (filters.appointmentTo)
        where.appointmentDate.lte = new Date(filters.appointmentTo);
    }

    // Booking-relation filters (lab + status bucket). A candidate has at most
    // one active (non-cancelled) booking, so `some` approximates "the latest
    // booking". Combined via AND so lab + status can apply together.
    const bookingConds: any[] = [];
    if (filters.labId) {
      bookingConds.push({
        bookings: {
          some: {
            labId: filters.labId,
            status: { notIn: ['CANCELLED'] },
            deletedAt: null,
          },
        },
      });
    }
    switch (filters.statusBucket) {
      case 'APPT_REQ':
        bookingConds.push({
          bookings: {
            none: { status: { notIn: ['CANCELLED'] }, deletedAt: null },
          },
        });
        break;
      case 'SCHEDULE':
        bookingConds.push({
          bookings: { some: { status: 'SCHEDULED', deletedAt: null } },
        });
        break;
      case 'REPORT_PENDING':
        bookingConds.push({
          bookings: { some: { status: 'VISITED', deletedAt: null } },
        });
        break;
      case 'DONE':
        bookingConds.push({
          bookings: {
            some: {
              status: { in: ['REPORT_UPLOADED', 'FIT', 'UNFIT'] },
              deletedAt: null,
            },
          },
        });
        break;
    }
    if (bookingConds.length) where.AND = bookingConds;
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
      include: this.buildInclude(withRel),
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

  // Candidate counts by type (and total), scoped to the caller. Drives the
  // type-filter tiles without loading every candidate into the client.
  async typeCounts(user: { id: string; role: string }) {
    const where: any = { deletedAt: null };
    if (user.role !== 'ADMIN') where.clientId = user.id;
    const grouped = await this.prisma.candidate.groupBy({
      by: ['candidateType'],
      where,
      _count: { _all: true },
    });
    const counts: Record<string, number> = {
      ALL: 0,
      NEW_JOINER: 0,
      EXISTING: 0,
      ANNUAL: 0,
    };
    for (const g of grouped) {
      counts[g.candidateType] = g._count._all;
      counts.ALL += g._count._all;
    }
    return counts;
  }

  // Extends CANDIDATE_INCLUDE with optional per-candidate relations so list
  // pages can render booking-status / report info without separately loading
  // the entire bookings / reports tables. Bounded by pagination (the latest
  // non-cancelled booking; all of the candidate's reports with their files).
  private buildInclude(withRel?: { booking?: boolean; reports?: boolean }) {
    const include: any = { ...CANDIDATE_INCLUDE };
    if (withRel?.booking) {
      include.bookings = {
        where: { status: { not: 'CANCELLED' as const }, deletedAt: null },
        orderBy: { createdAt: 'desc' as const },
        take: 1,
        select: {
          id: true,
          bookingId: true,
          candidateId: true,
          clientId: true,
          status: true,
          reqDate: true,
          scheduledDate: true,
          visitTime: true,
          timeSlot: true,
          panel: {
            select: {
              id: true,
              name: true,
              bundledTest: {
                select: { id: true, name: true, testsIncluded: true },
              },
            },
          },
          lab: {
            select: {
              id: true,
              name: true,
              contactMobile: true,
              address: true,
              pincode: true,
            },
          },
          // The report attached to this booking, if uploaded (dashboard column
          // + ReportManagerModal). Full report shape so the manager modal has
          // everything it edits.
          report: {
            select: {
              id: true,
              bookingId: true,
              candidateId: true,
              reportUrl: true,
              fitnessStatus: true,
              labInternalRef: true,
              isInsure: true,
              approvalStatus: true,
              uploadedAt: true,
              uploadedBy: true,
              remarks: true,
              createdAt: true,
              files: {
                select: {
                  id: true,
                  reportId: true,
                  fileUrl: true,
                  fileKey: true,
                  fileName: true,
                  fileSize: true,
                  testsCovered: true,
                  createdAt: true,
                },
              },
            },
          },
          // Oldest→newest; isRescheduled() reads the last entry.
          scheduleHistory: {
            orderBy: { createdAt: 'asc' as const },
            select: { changedBy: true, createdAt: true },
          },
        },
      };
    }
    if (withRel?.reports) {
      include.reports = {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' as const },
        select: {
          id: true,
          bookingId: true,
          candidateId: true,
          fitnessStatus: true,
          approvalStatus: true,
          uploadedAt: true,
          createdAt: true,
          files: {
            select: {
              id: true,
              reportId: true,
              fileUrl: true,
              fileKey: true,
              fileName: true,
              fileSize: true,
              testsCovered: true,
              createdAt: true,
            },
          },
        },
      };
    }
    return include;
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

    // First pass validates every row WITHOUT touching the DB, collecting the
    // candidate records to insert; invalid rows are skipped and reported.
    const toCreate: any[] = [];
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

      toCreate.push({
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
      });
    }

    // Single transaction for all valid rows: reserve a contiguous block of
    // display IDs, then insert with one createMany — instead of opening a
    // transaction and round-tripping per row (the previous N+1).
    if (toCreate.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        const ids = await this.idSeq.generateBlock('C', toCreate.length, tx);
        await tx.candidate.createMany({
          data: toCreate.map((data, idx) => ({
            ...data,
            candidateId: ids[idx],
          })),
        });
      });
      result.created += toCreate.length;
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
