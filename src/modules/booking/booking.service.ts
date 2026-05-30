import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { Role } from '../../common/enums/role.enum';

const BOOKING_INCLUDE = {
  candidate: {
    select: {
      id: true, name: true, employeeCode: true, mobile: true, panNumber: true,
      gender: true, age: true, storeId: true,
      store: { select: { id: true, name: true, storeCode: true } },
    },
  },
  panel: {
    select: {
      id: true, name: true, mrp: true, costToVendor: true,
      bundledTest: { select: { id: true, name: true, testsIncluded: true } },
    },
  },
  lab: {
    select: { id: true, name: true, contactName: true, contactMobile: true, email: true, address: true, pincode: true },
  },
  client: { select: { id: true, name: true, email: true } },
};

@Injectable()
export class BookingService {
  constructor(private prisma: PrismaService) {}

  // ── Admin: candidates awaiting booking ─────────────────────────
  // A "booking request" = candidate with an appointmentDate but no active
  // booking yet. HR sets appointmentDate when creating the candidate.
  async findRequests() {
    const candidates = await this.prisma.candidate.findMany({
      where: {
        deletedAt: null,
        appointmentDate: { not: null },
        bookings: {
          none: { status: { notIn: ['CANCELLED'] }, deletedAt: null },
        },
      },
      include: {
        store: { select: { id: true, name: true, storeCode: true } },
        client: { select: { id: true, name: true, email: true } },
      },
      orderBy: { appointmentDate: 'asc' },
    });
    return candidates;
  }

  // ── Admin books a candidate by assigning a panel ───────────────
  async create(dto: CreateBookingDto) {
    const candidate = await this.prisma.candidate.findFirst({
      where: { id: dto.candidateId, deletedAt: null },
    });
    if (!candidate) throw new NotFoundException('Candidate not found');
    if (!candidate.appointmentDate) {
      throw new BadRequestException('Candidate has no appointment date set');
    }

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
      where: { clientId: candidate.clientId, panelId: dto.panelId, deletedAt: null },
    });
    const amountCharged = pricing ? pricing.costToClient : panel.mrp;

    return this.prisma.booking.create({
      data: {
        candidateId: candidate.id,
        panelId: panel.id,
        labId: panel.labId,
        clientId: candidate.clientId,
        reqDate: candidate.appointmentDate,
        scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : candidate.appointmentDate,
        timeSlot: dto.timeSlot,
        amountCharged,
        amountToVendor: panel.costToVendor,
        status: 'SCHEDULED',
      },
      include: BOOKING_INCLUDE,
    });
  }

  async findAll(
    user: { id: string; role: string },
    filters: { status?: string; clientId?: string } = {},
  ) {
    const where: any = { deletedAt: null };
    if (user.role !== Role.ADMIN) {
      where.clientId = user.id;
    } else if (filters.clientId) {
      where.clientId = filters.clientId;
    }
    if (filters.status) where.status = filters.status;

    return this.prisma.booking.findMany({
      where,
      include: BOOKING_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
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
        ...(dto.scheduledDate && { scheduledDate: new Date(dto.scheduledDate) }),
        ...(dto.timeSlot && { timeSlot: dto.timeSlot }),
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
