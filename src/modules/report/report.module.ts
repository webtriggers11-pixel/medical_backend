import { Module } from '@nestjs/common';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { S3Service } from '../../common/storage/s3.service';
import { CandidatesModule } from '../candidates/candidates.module';

@Module({
  imports: [CandidatesModule],
  controllers: [ReportController],
  providers: [ReportService, S3Service],
  exports: [ReportService],
})
export class ReportModule {}
