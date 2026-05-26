import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class CompanyService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCompanyDto, userId: string) {
    const code = dto.code ?? this.generateCode(dto.name);

    const existing = await this.prisma.company.findUnique({ where: { code } });
    if (existing) throw new ConflictException(`Company code "${code}" already exists`);

    return this.prisma.company.create({
      data: {
        name: dto.name,
        code,
        industryType: dto.industryType,
        gstNumber: dto.gstNumber,
        contactName: dto.contactName,
        contactMobile: dto.contactMobile,
        billingEmail: dto.billingEmail,
        checkupFrequency: dto.checkupFrequency,
        createdBy: userId,
      },
    });
  }

  async findAll(user: { sub: string; role: string; companyId?: string }) {
    const where =
      user.role === Role.SUPER_ADMIN
        ? { deletedAt: null }
        : { id: user.companyId, deletedAt: null };

    return this.prisma.company.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: { sub: string; role: string; companyId?: string }) {
    const company = await this.prisma.company.findFirst({
      where: { id, deletedAt: null },
    });

    if (!company) throw new NotFoundException('Company not found');

    if (user.role !== Role.SUPER_ADMIN && company.id !== user.companyId) {
      throw new ForbiddenException('Access denied');
    }

    return company;
  }

  async update(
    id: string,
    dto: UpdateCompanyDto,
    user: { sub: string; role: string; companyId?: string },
  ) {
    await this.findOne(id, user);

    return this.prisma.company.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, user: { sub: string; role: string; companyId?: string }) {
    await this.findOne(id, user);

    return this.prisma.company.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: user.sub,
        status: 'INACTIVE',
      },
    });
  }

  private generateCode(name: string): string {
    return name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6)
      .padEnd(4, 'X') + Math.floor(100 + Math.random() * 900).toString();
  }
}
