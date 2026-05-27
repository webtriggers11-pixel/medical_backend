import { Module } from '@nestjs/common';
import { LabController } from './lab.controller';
import { LabService } from './lab.service';
import { BundledTestController } from './bundled-test.controller';
import { BundledTestService } from './bundled-test.service';

@Module({
  controllers: [LabController, BundledTestController],
  providers: [LabService, BundledTestService],
  exports: [LabService, BundledTestService],
})
export class LabModule {}
