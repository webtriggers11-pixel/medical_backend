import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';
import {
  buildPaginated,
  resolvePagination,
  type PaginationInput,
} from '../../common/pagination/pagination';

const REPORT_INCLUDE = {
  booking: {
    select: {
      id: true,
      status: true,
      panel: { select: { id: true, name: true } },
      lab: { select: { id: true, name: true } },
    },
  },
  candidate: { select: { id: true, name: true, employeeCode: true } },
  files: { orderBy: { createdAt: 'asc' as const } },
};

@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateReportDto, userId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: dto.bookingId, deletedAt: null },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const existing = await this.prisma.report.findFirst({
      where: { bookingId: dto.bookingId, deletedAt: null },
    });
    if (existing)
      throw new ConflictException('Report already exists for this booking');

    const report = await this.prisma.report.create({
      data: {
        bookingId: dto.bookingId,
        candidateId: booking.candidateId,
        // reportUrl is kept for backward compatibility — first file is primary.
        reportUrl: dto.files[0].fileUrl,
        fitnessStatus: dto.fitnessStatus,
        labInternalRef: dto.labInternalRef,
        isInsure: dto.isInsure ?? false,
        approvalStatus: dto.approvalStatus ?? false,
        remarks: dto.remarks,
        uploadedBy: userId,
        createdBy: userId,
        files: {
          create: dto.files.map((f) => ({
            fileUrl: f.fileUrl,
            fileName: f.fileName,
            fileSize: f.fileSize,
            testsCovered: f.testsCovered,
          })),
        },
      },
      include: REPORT_INCLUDE,
    });

    // Advance booking status to REPORT_UPLOADED
    await this.prisma.booking.update({
      where: { id: dto.bookingId },
      data: { status: 'REPORT_UPLOADED' },
    });

    return report;
  }

  // All reports visible to the caller — ADMIN sees everything; a USER (client)
  // sees only reports for their own candidates.
  async findAllForUser(user: { id: string; role: string }) {
    const where: any = { deletedAt: null };
    if (user.role !== 'ADMIN') {
      where.candidate = { clientId: user.id };
    }
    return this.prisma.report.findMany({
      where,
      include: REPORT_INCLUDE,
      orderBy: { createdAt: 'desc' as const },
    });
  }

  async findByCandidate(candidateId: string, pagination?: PaginationInput) {
    const query = {
      where: { candidateId, deletedAt: null },
      include: REPORT_INCLUDE,
      orderBy: { createdAt: 'desc' as const },
    };
    const { wants, page, limit, skip, take } = resolvePagination(pagination);
    if (!wants) return this.prisma.report.findMany(query);
    const [items, total] = await Promise.all([
      this.prisma.report.findMany({ ...query, skip, take }),
      this.prisma.report.count({ where: query.where }),
    ]);
    return buildPaginated(items, total, page, limit);
  }

  async findByBooking(bookingId: string) {
    return this.prisma.report.findFirst({
      where: { bookingId, deletedAt: null },
      include: REPORT_INCLUDE,
    });
  }
}
