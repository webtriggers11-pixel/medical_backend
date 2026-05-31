import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePanelDto } from './dto/create-panel.dto';
import { UpdatePanelDto } from './dto/update-panel.dto';
import { SetClientPricingDto } from './dto/set-client-pricing.dto';
import {
  buildPaginated,
  resolvePagination,
  type PaginationInput,
} from '../../common/pagination/pagination';

const PANEL_INCLUDE = {
  lab: {
    select: {
      id: true,
      name: true,
      address: true,
      pincode: true,
      serviceCities: true,
    },
  },
  bundledTest: { select: { id: true, name: true, testsIncluded: true } },
  panelTests: {
    include: {
      testMaster: { select: { id: true, name: true, status: true } },
    },
  },
  clientPricing: {
    where: { deletedAt: null },
    include: {
      client: { select: { id: true, name: true, email: true } },
    },
  },
} as const;

@Injectable()
export class PanelService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreatePanelDto, userId: string) {
    const lab = await this.prisma.lab.findFirst({
      where: { id: dto.labId, deletedAt: null },
    });
    if (!lab) throw new NotFoundException('Lab not found');

    /* BUNDLED TEST — replaced by TestMaster
    const bundledTest = await this.prisma.labBundledTest.findFirst({
      where: { id: dto.bundledTestId, labId: dto.labId, deletedAt: null },
    });
    if (!bundledTest)
      throw new NotFoundException('Bundled test not found for this lab');
    */

    // Validate each testMasterId exists and is not deleted
    for (const tmId of dto.testMasterIds) {
      const test = await this.prisma.testMaster.findFirst({
        where: { id: tmId, deletedAt: null },
      });
      if (!test) throw new NotFoundException(`Test not found: ${tmId}`);
    }

    return this.prisma.$transaction(async (tx) => {
      const panel = await tx.panel.create({
        data: {
          labId: dto.labId,
          name: dto.name,
          timing: dto.timing,
          mrp: dto.mrp,
          costToVendor: dto.costToVendor,
          labContact: dto.labContact,
          createdBy: userId,
        },
      });

      await tx.panelTest.createMany({
        data: dto.testMasterIds.map((testMasterId) => ({
          panelId: panel.id,
          testMasterId,
        })),
      });

      return tx.panel.findUnique({
        where: { id: panel.id },
        include: PANEL_INCLUDE,
      });
    });
  }

  async findAll(filters: { labId?: string }, pagination?: PaginationInput) {
    const where: any = { deletedAt: null };

    if (filters.labId) {
      where.labId = filters.labId;
    }

    const query = {
      where,
      include: PANEL_INCLUDE,
      orderBy: { createdAt: 'desc' as const },
    };
    const { wants, page, limit, skip, take } = resolvePagination(pagination);
    if (!wants) return this.prisma.panel.findMany(query);
    const [items, total] = await Promise.all([
      this.prisma.panel.findMany({ ...query, skip, take }),
      this.prisma.panel.count({ where }),
    ]);
    return buildPaginated(items, total, page, limit);
  }

  async findOne(id: string) {
    const panel = await this.prisma.panel.findFirst({
      where: { id, deletedAt: null },
      include: PANEL_INCLUDE,
    });
    if (!panel) throw new NotFoundException('Panel not found');
    return panel;
  }

  async update(id: string, dto: UpdatePanelDto) {
    const panel = await this.prisma.panel.findFirst({
      where: { id, deletedAt: null },
    });
    if (!panel) throw new NotFoundException('Panel not found');

    return this.prisma.panel.update({
      where: { id },
      data: dto,
      include: PANEL_INCLUDE,
    });
  }

  async remove(id: string, userId: string) {
    const panel = await this.prisma.panel.findFirst({
      where: { id, deletedAt: null },
    });
    if (!panel) throw new NotFoundException('Panel not found');

    await this.prisma.panel.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: userId, status: 'INACTIVE' },
    });
    return { message: 'Panel deleted' };
  }

  // ── Client pricing ───────────────────────────────────────────

  async setClientPricing(
    panelId: string,
    dto: SetClientPricingDto,
    userId: string,
  ) {
    const panel = await this.prisma.panel.findFirst({
      where: { id: panelId, deletedAt: null },
    });
    if (!panel) throw new NotFoundException('Panel not found');

    const client = await this.prisma.user.findFirst({
      where: { id: dto.clientId, role: 'USER' },
    });
    if (!client) throw new NotFoundException('Client not found');

    return this.prisma.clientPanelPricing.upsert({
      where: { clientId_panelId: { clientId: dto.clientId, panelId } },
      create: {
        clientId: dto.clientId,
        panelId,
        costToClient: dto.costToClient,
        discountAfterN: dto.discountAfterN ?? 0,
        discountedPrice: dto.discountedPrice ?? dto.costToClient,
        createdBy: userId,
      },
      update: {
        costToClient: dto.costToClient,
        discountAfterN: dto.discountAfterN ?? 0,
        discountedPrice: dto.discountedPrice ?? dto.costToClient,
        deletedAt: null,
        deletedBy: null,
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        panel: {
          select: { id: true, name: true, mrp: true, costToVendor: true },
        },
      },
    });
  }

  async getClientPricing(panelId: string, pagination?: PaginationInput) {
    const panel = await this.prisma.panel.findFirst({
      where: { id: panelId, deletedAt: null },
    });
    if (!panel) throw new NotFoundException('Panel not found');

    const query = {
      where: { panelId, deletedAt: null },
      include: { client: { select: { id: true, name: true, email: true } } },
    };
    const { wants, page, limit, skip, take } = resolvePagination(pagination);
    if (!wants) return this.prisma.clientPanelPricing.findMany(query);
    const [items, total] = await Promise.all([
      this.prisma.clientPanelPricing.findMany({ ...query, skip, take }),
      this.prisma.clientPanelPricing.count({ where: query.where }),
    ]);
    return buildPaginated(items, total, page, limit);
  }

  async removeClientPricing(panelId: string, clientId: string, userId: string) {
    const pricing = await this.prisma.clientPanelPricing.findFirst({
      where: { panelId, clientId, deletedAt: null },
    });
    if (!pricing) throw new NotFoundException('Pricing not found');

    await this.prisma.clientPanelPricing.update({
      where: { clientId_panelId: { clientId, panelId } },
      data: { deletedAt: new Date(), deletedBy: userId },
    });
    return { message: 'Client pricing removed' };
  }
}
