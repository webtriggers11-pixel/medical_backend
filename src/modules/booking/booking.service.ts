import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { Role } from '../../common/enums/role.enum';

const BOOKING_INCLUDE = {
  candidate: {
    select: { id: true, name: true, employeeCode: true, mobile: true, panNumber: true, gender: true, age: true },
  },
  panel: {
    select: { id: true, name: true, mrp: true, costToVendor: true },
  },
  lab: {
    select: { id: true, name: true, contactName: true, contactMobile: true, address: true },
  },
  client: {
    select: { id: true, name: true, email: true },
  },
};

@Injectable()
export class BookingService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateBookingDto, user: { id: string; role: string }) {
    // Validate candidate
    const candidate = await this.prisma.candidate.findFirst({
      where: { id: dto.candidateId, deletedAt: null },
    });
    if (!candidate) throw new NotFoundException('Candidate not found');

    // Scope check — USER can only book their own candidates
    if (user.role !== Role.ADMIN && candidate.clientId !== user.id) {
      throw new ForbiddenException('Access denied');
    }

    // Validate panel
    const panel = await this.prisma.panel.findFirst({
      where: { id: dto.panelId, deletedAt: null, status: 'ACTIVE' },
    });
    if (!panel) throw new NotFoundException('Panel not found');

    // Minimum 1-day gap from today
    const reqDate = new Date(dto.reqDate);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    if (reqDate < tomorrow) {
      throw new BadRequestException('Appointment date must be at least 1 day from today');
    }

    // Check candidate not already booked (no active booking)
    const existing = await this.prisma.booking.findFirst({
      where: {
        candidateId: dto.candidateId,
        status: { notIn: ['CANCELLED', 'FIT', 'UNFIT'] },
        deletedAt: null,
      },
    });
    if (existing) {
      throw new BadRequestException('Candidate already has an active booking');
    }

    // Get client pricing for amount calculation
    const clientId = user.role === Role.ADMIN ? candidate.clientId : user.id;
    const pricing = await this.prisma.clientPanelPricing.findFirst({
      where: { clientId, panelId: dto.panelId, deletedAt: null },
    });

    const amountCharged = pricing ? pricing.costToClient : panel.mrp;
    const amountToVendor = panel.costToVendor;

    return this.prisma.booking.create({
      data: {
        candidateId: dto.candidateId,
        panelId: dto.panelId,
        labId: panel.labId,
        clientId,
        reqDate,
        timeSlot: dto.timeSlot,
        amountCharged,
        amountToVendor,
        createdBy: user.id,
      },
      include: BOOKING_INCLUDE,
    });
  }

  async findAll(
    user: { id: string; role: string },
    filters: { status?: string; clientId?: string } = {},
  ) {
    const where: any = { deletedAt: null };

    // USER sees only their own bookings
    if (user.role !== Role.ADMIN) {
      where.clientId = user.id;
    } else if (filters.clientId) {
      where.clientId = filters.clientId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    return this.prisma.booking.findMany({
      where,
      include: BOOKING_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  // Pending = APPOINTMENT_REQUESTED — shown on admin dashboard
  async findPending() {
    return this.prisma.booking.findMany({
      where: { status: 'APPOINTMENT_REQUESTED', deletedAt: null },
      include: {
        ...BOOKING_INCLUDE,
        client: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateStatus(
    id: string,
    dto: UpdateBookingStatusDto,
    user: { id: string; role: string },
  ) {
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
