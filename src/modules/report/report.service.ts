import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { S3Service } from '../../common/storage/s3.service';
import {
  isS3Storage,
  REPORTS_PUBLIC_PREFIX,
} from '../../common/storage/storage.constants';
import { Role } from '../../common/enums/role.enum';
import {
  buildPaginated,
  resolvePagination,
  type PaginationInput,
} from '../../common/pagination/pagination';

export interface UploadedDescriptor {
  fileUrl: string;
  fileKey?: string;
  fileName: string;
  fileSize: number;
}

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
  private readonly logger = new Logger(ReportService.name);

  constructor(
    private prisma: PrismaService,
    private s3: S3Service,
  ) {}

  /** Best-effort removal of a stored object from S3 (never throws). */
  private async deleteStored(fileKey?: string | null): Promise<void> {
    if (!fileKey) return; // legacy disk files are left in place
    try {
      await this.s3.delete(fileKey);
    } catch (e) {
      this.logger.warn(`Failed to delete report object ${fileKey}: ${e}`);
    }
  }

  /** Store uploaded files (S3 or local disk) and return their descriptors. */
  async uploadFiles(
    files: Express.Multer.File[],
    scope = 'misc',
  ): Promise<UploadedDescriptor[]> {
    if (isS3Storage()) {
      return Promise.all(
        files.map(async (f) => {
          const key = this.s3.buildKey(f.originalname, scope);
          await this.s3.upload(f.buffer, { key, contentType: f.mimetype });
          return {
            fileUrl: key, // reference; downloads go through the presign endpoint
            fileKey: key,
            fileName: f.originalname,
            fileSize: f.size,
          };
        }),
      );
    }
    // disk driver (local dev): multer wrote the file; expose its public path.
    return files.map((f) => ({
      fileUrl: `${REPORTS_PUBLIC_PREFIX}/${f.filename}`,
      fileName: f.originalname,
      fileSize: f.size,
    }));
  }

  /** Resolve a downloadable URL for a report file (presigned for S3). */
  async getFileDownloadUrl(
    fileId: string,
    user: { id: string; role: string },
  ): Promise<{ url: string }> {
    const file = await this.prisma.reportFile.findUnique({
      where: { id: fileId },
      include: {
        report: { include: { candidate: { select: { clientId: true } } } },
      },
    });
    if (!file) throw new NotFoundException('File not found');
    // USER may only access files for their own candidates.
    if (
      user.role !== Role.ADMIN &&
      file.report?.candidate?.clientId !== user.id
    ) {
      throw new NotFoundException('File not found');
    }
    if (file.fileKey) {
      return { url: await this.s3.getSignedDownloadUrl(file.fileKey) };
    }
    if (file.fileUrl) return { url: file.fileUrl }; // legacy disk path
    throw new BadRequestException('File has no stored location');
  }

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
            fileKey: f.fileKey ?? null,
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

  // Update report metadata and/or its files (add new, remove existing, retag).
  async update(id: string, dto: UpdateReportDto) {
    const report = await this.prisma.report.findFirst({
      where: { id, deletedAt: null },
      include: { files: true },
    });
    if (!report) throw new NotFoundException('Report not found');

    const removeIds = dto.removeFileIds ?? [];
    const addFiles = dto.addFiles ?? [];
    const fileUpdates = dto.fileUpdates ?? [];

    // Every referenced file must belong to this report.
    const ownIds = new Set(report.files.map((f) => f.id));
    for (const rid of removeIds)
      if (!ownIds.has(rid))
        throw new BadRequestException(
          'A file marked for removal does not belong to this report',
        );
    for (const fu of fileUpdates)
      if (!ownIds.has(fu.id))
        throw new BadRequestException(
          'A file to update does not belong to this report',
        );

    // A report must always keep at least one file.
    const remaining = report.files.length - removeIds.length + addFiles.length;
    if (remaining < 1)
      throw new BadRequestException('A report must keep at least one file');

    const filesToDelete = report.files.filter((f) => removeIds.includes(f.id));

    const updated = await this.prisma.$transaction(async (tx) => {
      if (removeIds.length)
        await tx.reportFile.deleteMany({
          where: { id: { in: removeIds }, reportId: id },
        });

      for (const f of addFiles)
        await tx.reportFile.create({
          data: {
            reportId: id,
            fileUrl: f.fileUrl,
            fileKey: f.fileKey ?? null,
            fileName: f.fileName,
            fileSize: f.fileSize ?? null,
            testsCovered: f.testsCovered,
          },
        });

      for (const fu of fileUpdates)
        await tx.reportFile.update({
          where: { id: fu.id },
          data: { testsCovered: fu.testsCovered },
        });

      // Keep the legacy primary pointer (reportUrl) in sync with a live file.
      const files = await tx.reportFile.findMany({
        where: { reportId: id },
        orderBy: { createdAt: 'asc' },
      });

      const data: Record<string, unknown> = {};
      if (dto.fitnessStatus !== undefined)
        data.fitnessStatus = dto.fitnessStatus;
      if (dto.remarks !== undefined) data.remarks = dto.remarks;
      if (dto.labInternalRef !== undefined)
        data.labInternalRef = dto.labInternalRef;
      if (dto.isInsure !== undefined) data.isInsure = dto.isInsure;
      if (dto.approvalStatus !== undefined)
        data.approvalStatus = dto.approvalStatus;
      if (files[0]) data.reportUrl = files[0].fileUrl;

      return tx.report.update({
        where: { id },
        data,
        include: REPORT_INCLUDE,
      });
    });

    // Storage cleanup happens after the DB commit so a storage hiccup never
    // rolls back the metadata change.
    await Promise.all(filesToDelete.map((f) => this.deleteStored(f.fileKey)));

    return updated;
  }

  // Delete a whole report: soft-delete the report, drop its files (DB + S3),
  // and revert the booking so a fresh report can be uploaded.
  async remove(id: string) {
    const report = await this.prisma.report.findFirst({
      where: { id, deletedAt: null },
      include: { files: true },
    });
    if (!report) throw new NotFoundException('Report not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.reportFile.deleteMany({ where: { reportId: id } });
      await tx.report.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await tx.booking.update({
        where: { id: report.bookingId },
        data: { status: 'VISITED' },
      });
    });

    await Promise.all(report.files.map((f) => this.deleteStored(f.fileKey)));

    return { id, deleted: true };
  }

  async findByBooking(bookingId: string) {
    return this.prisma.report.findFirst({
      where: { bookingId, deletedAt: null },
      include: REPORT_INCLUDE,
    });
  }
}
