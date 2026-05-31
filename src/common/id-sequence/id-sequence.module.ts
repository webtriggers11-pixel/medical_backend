import { Global, Module } from '@nestjs/common';
import { IdSequenceService } from './id-sequence.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [IdSequenceService],
  exports: [IdSequenceService],
})
export class IdSequenceModule {}
