import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

// Generates prefix-sequential IDs (e.g. B001, L012, C1000).
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

    // padStart(3,'0') pads to minimum 3 digits — grows naturally beyond 999.
    return `${prefix}${String(seq.nextVal).padStart(3, '0')}`;
  }
}
