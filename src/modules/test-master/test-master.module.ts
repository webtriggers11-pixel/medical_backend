import { Module } from '@nestjs/common';
import { TestMasterController } from './test-master.controller';
import { TestMasterService } from './test-master.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TestMasterController],
  providers: [TestMasterService],
  exports: [TestMasterService],
})
export class TestMasterModule {}
