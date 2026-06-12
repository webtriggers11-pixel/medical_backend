import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

// Generates prefix-sequential IDs (e.g. B-0000001, CL-0000042).
// Must be called inside a prisma.$transaction so the counter
// increment and the record insert are atomic — if the insert
// rolls back, the counter rolls back too.
@Injectable()
export class IdSequenceService {
  async generate(prefix: string, tx: TxClient): Promise<string> {
    const seq = await tx.idSequence
      .update({
        where: { prefix },
        data: { nextVal: { increment: 1 } },
        select: { nextVal: true },
      })
      .catch(() => {
        throw new InternalServerErrorException(
          `ID sequence not found for prefix "${prefix}". Re-run the seed.`,
        );
      });

    // padStart(7,'0') pads to 7 digits — grows naturally beyond 9999999.
    return `${prefix}-${String(seq.nextVal).padStart(7, '0')}`;
  }
}
