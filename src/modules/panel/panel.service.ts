import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePanelDto } from './dto/create-panel.dto';
import { UpdatePanelDto } from './dto/update-panel.dto';
import { SetCompanyPricingDto } from './dto/set-company-pricing.dto';

@Injectable()
export class PanelService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreatePanelDto, userId: string) {
    const lab = await this.prisma.lab.findFirst({
      where: { id: dto.labId, deletedAt: null },
    });
    if (!lab) throw new NotFoundException('Lab not found');

    const bundledTest = await this.prisma.labBundledTest.findFirst({
      where: { id: dto.bundledTestId, labId: dto.labId, deletedAt: null },
    });
    if (!bundledTest) throw new NotFoundException('Bundled test not found for this lab');

    return this.prisma.panel.create({
      data: {
        labId: dto.labId,
        bundledTestId: dto.bundledTestId,
        name: dto.name,
        timing: dto.timing,
        mrp: dto.mrp,
        costToVendor: dto.costToVendor,
        labContact: dto.labContact,
        createdBy: userId,
      },
      include: {
        lab: { select: { id: true, name: true } },
        bundledTest: { select: { id: true, name: true, testsIncluded: true } },
      },
    });
  }

  async findAll(filters: { labId?: string }) {
    const where: any = { deletedAt: null };

    if (filters.labId) {
      where.labId = filters.labId;
    }

    return this.prisma.panel.findMany({
      where,
      include: {
        lab: { select: { id: true, name: true, serviceCities: true } },
        bundledTest: { select: { id: true, name: true, testsIncluded: true } },
        companyPricing: {
          where: { deletedAt: null },
          select: {
            id: true,
            companyId: true,
            costToClient: true,
            discountAfterN: true,
            discountedPrice: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const panel = await this.prisma.panel.findFirst({
      where: { id, deletedAt: null },
      include: {
        lab: { select: { id: true, name: true, serviceCities: true } },
        bundledTest: { select: { id: true, name: true, testsIncluded: true, defaultTiming: true } },
        companyPricing: {
          where: { deletedAt: null },
          include: { company: { select: { id: true, name: true } } },
        },
      },
    });
    if (!panel) throw new NotFoundException('Panel not found');
    return panel;
  }

  async update(id: string, dto: UpdatePanelDto) {
    const panel = await this.prisma.panel.findFirst({ where: { id, deletedAt: null } });
    if (!panel) throw new NotFoundException('Panel not found');

    return this.prisma.panel.update({
      where: { id },
      data: dto,
      include: {
        lab: { select: { id: true, name: true } },
        bundledTest: { select: { id: true, name: true } },
      },
    });
  }

  async remove(id: string, userId: string) {
    const panel = await this.prisma.panel.findFirst({ where: { id, deletedAt: null } });
    if (!panel) throw new NotFoundException('Panel not found');

    await this.prisma.panel.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: userId, status: 'INACTIVE' },
    });
    return { message: 'Panel deleted' };
  }

  // ── Company pricing ──────────────────────────────────────────

  async setCompanyPricing(panelId: string, dto: SetCompanyPricingDto, userId: string) {
    const panel = await this.prisma.panel.findFirst({ where: { id: panelId, deletedAt: null } });
    if (!panel) throw new NotFoundException('Panel not found');

    const company = await this.prisma.company.findFirst({ where: { id: dto.companyId, deletedAt: null } });
    if (!company) throw new NotFoundException('Company not found');

    return this.prisma.companyPanelPricing.upsert({
      where: { companyId_panelId: { companyId: dto.companyId, panelId } },
      create: {
        companyId: dto.companyId,
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
        company: { select: { id: true, name: true } },
        panel: { select: { id: true, name: true, mrp: true, costToVendor: true } },
      },
    });
  }

  async getCompanyPricing(panelId: string) {
    const panel = await this.prisma.panel.findFirst({ where: { id: panelId, deletedAt: null } });
    if (!panel) throw new NotFoundException('Panel not found');

    return this.prisma.companyPanelPricing.findMany({
      where: { panelId, deletedAt: null },
      include: { company: { select: { id: true, name: true } } },
    });
  }

  async removeCompanyPricing(panelId: string, companyId: string, userId: string) {
    const pricing = await this.prisma.companyPanelPricing.findFirst({
      where: { panelId, companyId, deletedAt: null },
    });
    if (!pricing) throw new NotFoundException('Pricing not found');

    await this.prisma.companyPanelPricing.update({
      where: { companyId_panelId: { companyId, panelId } },
      data: { deletedAt: new Date(), deletedBy: userId },
    });
    return { message: 'Company pricing removed' };
  }
}
