import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import {
  buildCandidateTemplate,
  parseCandidateCsv,
  validateRow,
} from './candidate-csv.util';

const CANDIDATE_SELECT = {
  id: true,
  zone: true,
  city: true,
  store: true,
  name: true,
  employeeCode: true,
  mobileNumber: true,
  gender: true,
  age: true,
  candidateType: true,
  dateOfJoining: true,
  pincode: true,
  email: true,
  panNumber: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
};

export interface BulkUploadResult {
  created: number;
  skipped: number;
  errors: { row: number; mobileNumber: string; reason: string }[];
}

@Injectable()
export class CandidatesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.candidate.findMany({
      select: CANDIDATE_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  create(dto: CreateCandidateDto, createdById?: string) {
    return this.prisma.candidate.create({
      data: {
        ...dto,
        dateOfJoining: new Date(dto.dateOfJoining),
        createdById,
      },
      select: CANDIDATE_SELECT,
    });
  }

  getTemplate(): string {
    return buildCandidateTemplate();
  }

  async bulkCreate(
    fileContent: string,
    createdById?: string,
  ): Promise<BulkUploadResult> {
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
      const rowNumber = i + 2; // +1 header, +1 for 1-based
      const validated = validateRow(rows[i]);

      if ('error' in validated) {
        result.skipped++;
        result.errors.push({
          row: rowNumber,
          mobileNumber: rows[i].mobileNumber || '(empty)',
          reason: validated.error,
        });
        continue;
      }

      const candidate = validated.data;

      if (seenMobiles.has(candidate.mobileNumber)) {
        result.skipped++;
        result.errors.push({
          row: rowNumber,
          mobileNumber: candidate.mobileNumber,
          reason: 'Duplicate mobile number within file',
        });
        continue;
      }
      seenMobiles.add(candidate.mobileNumber);

      await this.prisma.candidate.create({
        data: { ...candidate, createdById },
      });
      result.created++;
    }

    return result;
  }
}
