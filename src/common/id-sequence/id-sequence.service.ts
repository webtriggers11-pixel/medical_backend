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

  /**
   * Reserve a contiguous block of `count` display IDs in a single update,
   * returning them in order. Used by bulk inserts so we don't increment the
   * sequence once per row (one round-trip instead of N).
   */
  async generateBlock(
    prefix: string,
    count: number,
    tx: TxClient,
  ): Promise<string[]> {
    if (count <= 0) return [];
    const seq = await tx.idSequence
      .update({
        where: { prefix },
        data: { nextVal: { increment: count } },
        select: { nextVal: true },
      })
      .catch(() => {
        throw new InternalServerErrorException(
          `ID sequence not found for prefix "${prefix}". Re-run the seed.`,
        );
      });

    // After incrementing by `count`, `nextVal` is the highest value reserved;
    // the block is the `count` values ending there.
    const end = seq.nextVal;
    const start = end - BigInt(count) + 1n;
    const ids: string[] = [];
    for (let v = start; v <= end; v++) ids.push(String(v));
    return ids;
  }
}
