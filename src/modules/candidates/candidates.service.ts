import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { parseCandidateCsv, validateRow } from './candidate-csv.util';
import { buildCandidateTemplate } from './candidate-csv.util';

export interface BulkUploadResult {
  created: number;
  skipped: number;
  errors: { row: number; mobile: string; reason: string }[];
}

const CANDIDATE_SELECT = {
  id: true,
  storeId: true,
  companyId: true,
  name: true,
  employeeCode: true,
  mobile: true,
  gender: true,
  age: true,
  candidateType: true,
  doj: true,
  pincode: true,
  email: true,
  panNumber: true,
  isActive: true,
  createdBy: true,
  createdAt: true,
} as const;

@Injectable()
export class CandidatesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.candidate.findMany({
      where: { deletedAt: null },
      select: CANDIDATE_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  create(dto: CreateCandidateDto, createdBy?: string) {
    return this.prisma.candidate.create({
      data: {
        storeId: dto.storeId,
        companyId: dto.companyId,
        name: dto.name,
        employeeCode: dto.employeeCode,
        mobile: dto.mobile,
        gender: dto.gender,
        age: dto.age,
        candidateType: dto.candidateType,
        doj: dto.doj ? new Date(dto.doj) : undefined,
        pincode: dto.pincode ?? null,
        email: dto.email ?? null,
        panNumber: dto.panNumber,
        createdBy,
      },
      select: CANDIDATE_SELECT,
    });
  }

  getTemplate(): string {
    return buildCandidateTemplate();
  }

  async bulkCreate(fileContent: string, createdBy?: string): Promise<BulkUploadResult> {
    let rows;
    try {
      rows = parseCandidateCsv(fileContent);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    if (rows.length === 0) {
      throw new BadRequestException('No candidate rows found in the file.');
    }

    const result: BulkUploadResult = { created: 0, skipped: 0, errors: [] };
    const seenMobiles = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2;
      const validated = validateRow(rows[i]);

      if ('error' in validated) {
        result.skipped++;
        result.errors.push({ row: rowNumber, mobile: rows[i].mobile || '(empty)', reason: validated.error });
        continue;
      }

      const candidate = validated.data;

      if (seenMobiles.has(candidate.mobile)) {
        result.skipped++;
        result.errors.push({ row: rowNumber, mobile: candidate.mobile, reason: 'Duplicate mobile number within file' });
        continue;
      }
      seenMobiles.add(candidate.mobile);

      const { doj, ...rest } = candidate;
      await this.prisma.candidate.create({
        data: {
          ...rest,
          doj: doj ?? undefined,
          createdBy,
        },
      });
      result.created++;
    }

    return result;
  }
}
