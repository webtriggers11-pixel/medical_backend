import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const BOOKING_STATUSES = [
  'APPOINTMENT_REQUESTED',
  'SCHEDULED',
  'VISITED',
  'REPORT_UPLOADED',
  'FIT',
  'UNFIT',
  'CANCELLED',
] as const;

type StatusCounts = Record<(typeof BOOKING_STATUSES)[number], number>;

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  // Global stats across the whole platform — ADMIN only.
  async adminStats() {
    const live = { deletedAt: null };

    const [
      clientsTotal,
      clientsActive,
      storesTotal,
      labsTotal,
      labsActive,
      panelsTotal,
      panelsActive,
      testsTotal,
      testsActive,
      candidates,
      bookingsByStatus,
      reportsTotal,
      reportsApproved,
      amounts,
    ] = await Promise.all([
      this.prisma.user.count({ where: { ...live, role: 'USER' } }),
      this.prisma.user.count({
        where: { ...live, role: 'USER', isActive: true },
      }),
      this.prisma.store.count({ where: live }),
      this.prisma.lab.count({ where: live }),
      this.prisma.lab.count({ where: { ...live, status: 'ACTIVE' } }),
      this.prisma.panel.count({ where: live }),
      this.prisma.panel.count({ where: { ...live, status: 'ACTIVE' } }),
      this.prisma.testMaster.count({ where: live }),
      this.prisma.testMaster.count({ where: { ...live, status: 'ACTIVE' } }),
      this.candidateStats(),
      this.prisma.booking.groupBy({
        by: ['status'],
        where: live,
        _count: { _all: true },
      }),
      this.prisma.report.count({ where: live }),
      this.prisma.report.count({ where: { ...live, approvalStatus: true } }),
      this.prisma.booking.aggregate({
        where: live,
        _sum: { amountCharged: true, amountToVendor: true },
      }),
    ]);

    const byStatus = this.toStatusCounts(bookingsByStatus);
    const charged = Number(amounts._sum.amountCharged ?? 0);
    const vendorCost = Number(amounts._sum.amountToVendor ?? 0);

    return {
      clients: { total: clientsTotal, active: clientsActive },
      stores: { total: storesTotal },
      labs: { total: labsTotal, active: labsActive },
      panels: { total: panelsTotal, active: panelsActive },
      tests: { total: testsTotal, active: testsActive },
      candidates,
      bookings: {
        total: Object.values(byStatus).reduce((a, b) => a + b, 0),
        byStatus,
      },
      reports: { total: reportsTotal, approved: reportsApproved },
      revenue: { charged, vendorCost, margin: charged - vendorCost },
    };
  }

  // Stats scoped to one client (role USER) — their own portal dashboard.
  async clientStats(clientId: string) {
    const live = { deletedAt: null, clientId };

    const [storesTotal, candidates, bookingsByStatus, reportsTotal, amounts] =
      await Promise.all([
        this.prisma.store.count({ where: live }),
        this.candidateStats(clientId),
        this.prisma.booking.groupBy({
          by: ['status'],
          where: live,
          _count: { _all: true },
        }),
        this.prisma.report.count({
          where: { deletedAt: null, booking: { clientId } },
        }),
        this.prisma.booking.aggregate({
          where: live,
          _sum: { amountCharged: true },
        }),
      ]);

    const byStatus = this.toStatusCounts(bookingsByStatus);

    return {
      stores: { total: storesTotal },
      candidates,
      bookings: {
        total: Object.values(byStatus).reduce((a, b) => a + b, 0),
        byStatus,
      },
      reports: { total: reportsTotal },
      spend: { total: Number(amounts._sum.amountCharged ?? 0) },
    };
  }

  private async candidateStats(clientId?: string) {
    const live = { deletedAt: null, ...(clientId ? { clientId } : {}) };
    const [total, active, approved, withAppointment] = await Promise.all([
      this.prisma.candidate.count({ where: live }),
      this.prisma.candidate.count({ where: { ...live, isActive: true } }),
      this.prisma.candidate.count({ where: { ...live, isApproved: true } }),
      this.prisma.candidate.count({
        where: { ...live, appointmentDate: { not: null } },
      }),
    ]);
    return { total, active, approved, withAppointment };
  }

  private toStatusCounts(
    grouped: { status: string; _count: { _all: number } }[],
  ): StatusCounts {
    const counts = Object.fromEntries(
      BOOKING_STATUSES.map((s) => [s, 0]),
    ) as StatusCounts;
    for (const g of grouped) {
      counts[g.status as keyof StatusCounts] = g._count._all;
    }
    return counts;
  }
}
