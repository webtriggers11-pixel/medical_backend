import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

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

    return String(seq.nextVal);
  }
}
