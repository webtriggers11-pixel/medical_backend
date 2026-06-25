import { CandidatesService } from './candidates.service';

/**
 * Unit tests for the candidate list filter builder. Prisma is mocked so the
 * tests assert the generated `where` clause without touching the (live) DB.
 * Focus: the new schedule-date filter and that it composes with the existing
 * store/status filters while preserving USER client-scoping.
 */
describe('CandidatesService — list filters', () => {
  let service: CandidatesService;
  let findMany: jest.Mock;

  beforeEach(() => {
    findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      candidate: { findMany, count: jest.fn().mockResolvedValue(0) },
    } as any;
    const idSeq = {} as any;
    service = new CandidatesService(prisma, idSeq);
  });

  // The `where` passed to the (single, unpaginated) findMany call.
  const whereOf = () => findMany.mock.calls[0][0].where;
  const scheduleCond = (where: any) =>
    (where.AND as any[] | undefined)?.find(
      (c) => c?.bookings?.some?.scheduledDate,
    );

  it('adds a non-cancelled scheduled-date booking condition within range', async () => {
    await service.findAll(
      { id: 'client-1', role: 'USER' },
      { scheduleFrom: '2026-06-01', scheduleTo: '2026-06-30' },
    );
    const where = whereOf();
    expect(where.clientId).toBe('client-1'); // USER scope preserved
    const cond = scheduleCond(where);
    expect(cond).toBeDefined();
    expect(cond.bookings.some.scheduledDate.gte).toEqual(new Date('2026-06-01'));
    expect(cond.bookings.some.scheduledDate.lte).toEqual(new Date('2026-06-30'));
    expect(cond.bookings.some.status).toEqual({ notIn: ['CANCELLED'] });
    expect(cond.bookings.some.deletedAt).toBeNull();
  });

  it('supports an open-ended (from-only) schedule range', async () => {
    await service.findAll(
      { id: 'c', role: 'USER' },
      { scheduleFrom: '2026-06-01' },
    );
    const cond = scheduleCond(whereOf());
    expect(cond.bookings.some.scheduledDate.gte).toEqual(new Date('2026-06-01'));
    expect(cond.bookings.some.scheduledDate.lte).toBeUndefined();
  });

  it('composes schedule-date with store and status-bucket filters', async () => {
    await service.findAll(
      { id: 'c', role: 'USER' },
      { storeId: 'store-9', statusBucket: 'SCHEDULE', scheduleFrom: '2026-06-01' },
    );
    const where = whereOf();
    expect(where.storeId).toBe('store-9');
    const conds = where.AND as any[];
    expect(conds.some((c) => c?.bookings?.some?.status === 'SCHEDULED')).toBe(true);
    expect(conds.some((c) => c?.bookings?.some?.scheduledDate)).toBe(true);
  });

  it('omits the schedule condition when no range is given', async () => {
    await service.findAll({ id: 'c', role: 'USER' }, {});
    expect(scheduleCond(whereOf())).toBeUndefined();
  });

  it('does not let a USER widen scope via filters.clientId', async () => {
    await service.findAll(
      { id: 'client-X', role: 'USER' },
      { clientId: 'other-client', scheduleFrom: '2026-06-01' },
    );
    expect(whereOf().clientId).toBe('client-X');
  });

  describe('uploaded-date filter (client Reports page)', () => {
    it('matches candidates with a non-deleted report uploaded in range', async () => {
      await service.findAll(
        { id: 'client-1', role: 'USER' },
        { uploadFrom: '2026-06-01', uploadTo: '2026-06-30' },
      );
      const where = whereOf();
      expect(where.clientId).toBe('client-1'); // USER scope preserved
      expect(where.reports.some.uploadedAt.gte).toEqual(new Date('2026-06-01'));
      expect(where.reports.some.uploadedAt.lte).toEqual(new Date('2026-06-30'));
      expect(where.reports.some.deletedAt).toBeNull();
    });

    it('supports an open-ended (to-only) upload range', async () => {
      await service.findAll(
        { id: 'c', role: 'USER' },
        { uploadTo: '2026-06-30' },
      );
      const where = whereOf();
      expect(where.reports.some.uploadedAt.lte).toEqual(new Date('2026-06-30'));
      expect(where.reports.some.uploadedAt.gte).toBeUndefined();
    });

    it('composes the upload-date filter with a store filter', async () => {
      await service.findAll(
        { id: 'c', role: 'USER' },
        { storeId: 'store-7', uploadFrom: '2026-06-01' },
      );
      const where = whereOf();
      expect(where.storeId).toBe('store-7');
      expect(where.reports.some.uploadedAt.gte).toEqual(new Date('2026-06-01'));
    });

    it('omits the reports condition when no upload range is given', async () => {
      await service.findAll({ id: 'c', role: 'USER' }, { storeId: 'store-7' });
      expect(whereOf().reports).toBeUndefined();
    });
  });
});
