import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IdSequenceService } from '../../common/id-sequence/id-sequence.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto';
import { Role } from '../../common/enums/role.enum';
import {
  buildPaginated,
  resolvePagination,
  type PaginationInput,
} from '../../common/pagination/pagination';

const BOOKING_INCLUDE = {
  candidate: {
    select: {
      id: true,
      candidateId: true,
      name: true,
      employeeCode: true,
      mobile: true,
      panNumber: true,
      gender: true,
      age: true,
      storeId: true,
      store: { select: { id: true, name: true, storeCode: true } },
    },
  },
  panel: {
    select: {
      id: true,
      panelId: true,
      name: true,
      mrp: true,
      costToVendor: true,
      bundledTest: { select: { id: true, name: true, testsIncluded: true } },
    },
  },
  lab: {
    select: {
      id: true,
      labId: true,
      name: true,
      contactName: true,
      contactMobile: true,
      email: true,
      address: true,
      pincode: true,
    },
  },
  client: { select: { id: true, name: true, email: true } },
  scheduleHistory: { orderBy: { createdAt: 'asc' as const } },
};

@Injectable()
export class BookingService {
  constructor(
    private prisma: PrismaService,
    private idSeq: IdSequenceService,
  ) {}

  // ── Admin: candidates awaiting booking ─────────────────────────
  // A "booking request" = candidate with an appointmentDate but no active
  // booking yet. HR sets appointmentDate when creating the candidate.
  async findRequests(pagination?: PaginationInput, search?: string) {
    const q = search?.trim();
    const where: any = {
      deletedAt: null,
      appointmentDate: { not: null },
      bookings: {
        none: { status: { notIn: ['CANCELLED' as const] }, deletedAt: null },
      },
    };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' as const } },
        { employeeCode: { contains: q, mode: 'insensitive' as const } },
        { mobile: { contains: q } },
        {
          client: {
            is: {
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { email: { contains: q, mode: 'insensitive' as const } },
              ],
            },
          },
        },
      ];
    }
    const query = {
      where,
      include: {
        store: { select: { id: true, name: true, storeCode: true } },
        client: { select: { id: true, name: true, email: true } },
      },
      orderBy: { appointmentDate: 'asc' as const },
    };
    const { wants, page, limit, skip, take } = resolvePagination(pagination);
    if (!wants) return this.prisma.candidate.findMany(query);
    const [items, total] = await Promise.all([
      this.prisma.candidate.findMany({ ...query, skip, take }),
      this.prisma.candidate.count({ where }),
    ]);
    return buildPaginated(items, total, page, limit);
  }

  // ── Admin books a candidate by assigning a panel ───────────────
  async create(dto: CreateBookingDto) {
    const candidate = await this.prisma.candidate.findFirst({
      where: { id: dto.candidateId, deletedAt: null },
    });
    if (!candidate) throw new NotFoundException('Candidate not found');
    const panel = await this.prisma.panel.findFirst({
      where: { id: dto.panelId, deletedAt: null, status: 'ACTIVE' },
    });
    if (!panel) throw new NotFoundException('Panel not found');

    // No active booking already
    const existing = await this.prisma.booking.findFirst({
      where: {
        candidateId: dto.candidateId,
        status: { notIn: ['CANCELLED'] },
        deletedAt: null,
      },
    });
    if (existing) throw new BadRequestException('Candidate already booked');

    // Client-specific pricing for this panel; fall back to MRP
    const pricing = await this.prisma.clientPanelPricing.findFirst({
      where: {
        clientId: candidate.clientId,
        panelId: dto.panelId,
        deletedAt: null,
      },
    });
    const amountCharged = pricing ? pricing.costToClient : panel.mrp;
    const reqDate = candidate.appointmentDate ?? new Date();

    return this.prisma.$transaction(async (tx) => {
      const bookingId = await this.idSeq.generate('B', tx);
      return tx.booking.create({
        data: {
          bookingId,
          candidateId: candidate.id,
          panelId: panel.id,
          labId: panel.labId,
          clientId: candidate.clientId,
          reqDate,
          scheduledDate: dto.scheduledDate
            ? new Date(dto.scheduledDate)
            : reqDate,
          timeSlot: dto.timeSlot,
          amountCharged,
          amountToVendor: panel.costToVendor,
          status: 'SCHEDULED',
        },
        include: BOOKING_INCLUDE,
      });
    });
  }

  async findAll(
    user: { id: string; role: string },
    filters: { status?: string; clientId?: string } = {},
    pagination?: PaginationInput,
  ) {
    const where: any = { deletedAt: null };
    if (user.role !== Role.ADMIN) {
      where.clientId = user.id;
    } else if (filters.clientId) {
      where.clientId = filters.clientId;
    }
    if (filters.status) where.status = filters.status;

    const query = {
      where,
      include: BOOKING_INCLUDE,
      orderBy: { createdAt: 'desc' as const },
    };
    const { wants, page, limit, skip, take } = resolvePagination(pagination);
    if (!wants) return this.prisma.booking.findMany(query);
    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({ ...query, skip, take }),
      this.prisma.booking.count({ where }),
    ]);
    return buildPaginated(items, total, page, limit);
  }

  async updateStatus(id: string, dto: UpdateBookingStatusDto) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    return this.prisma.booking.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.scheduledDate && {
          scheduledDate: new Date(dto.scheduledDate),
        }),
        ...(dto.timeSlot && { timeSlot: dto.timeSlot }),
      },
      include: BOOKING_INCLUDE,
    });
  }

  // Reschedule a booking: log the previous schedule to history, then move the
  // booking to the new date/time. The original record is preserved.
  // ADMIN can reschedule any booking; a USER (client) only their own.
  async reschedule(
    id: string,
    dto: RescheduleBookingDto,
    user: { id: string; role: string },
  ) {
    const where: any = { id, deletedAt: null };
    if (user.role !== Role.ADMIN) where.clientId = user.id;
    const booking = await this.prisma.booking.findFirst({ where });
    if (!booking) throw new NotFoundException('Booking not found');

    await this.prisma.bookingScheduleChange.create({
      data: {
        bookingId: id,
        previousDate: booking.scheduledDate,
        previousTimeSlot: booking.timeSlot,
        newDate: new Date(dto.scheduledDate),
        newTimeSlot: dto.timeSlot ?? booking.timeSlot,
        reason: dto.reason,
        changedBy: user.id,
      },
    });

    return this.prisma.booking.update({
      where: { id },
      data: {
        scheduledDate: new Date(dto.scheduledDate),
        ...(dto.timeSlot && { timeSlot: dto.timeSlot }),
        status: 'SCHEDULED',
      },
      include: BOOKING_INCLUDE,
    });
  }

  async findOne(id: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null },
      include: BOOKING_INCLUDE,
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }
}
